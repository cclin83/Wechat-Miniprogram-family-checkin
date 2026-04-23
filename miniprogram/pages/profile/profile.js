const app = getApp()
const dbUtil = require('../../utils/db')
const util = require('../../utils/util')
Page({
  data: {
    openid: null, userInfo: { nickName: '', avatarUrl: '' }, role: null, familyId: null, isAdmin: false,
    totalCheckins: 0, totalCoins: 0, totalStepsFormatted: '0', streak: 0,
    familyName: '', inviteCode: '', memberCount: 0, members: [],
    showMembersModal: false, showInviteModal: false, isCreator: false, largeText: wx.getStorageSync("largeText") || false,
    showProfileSetup: false
  },
  async onLoad(options) {
    const openid = await app.getOpenid()
    this.setData({ openid })
    const userInfo = app.globalData.userInfo
    if (userInfo) this.setData({ userInfo })
    await this.loadUserData()
    if (options.action === 'create') this.createFamily()
    else if (options.action === 'join') this.joinFamily()
  },
  async onShow() {
    this.setData({ largeText: wx.getStorageSync("largeText") || false }); await this.loadUserData() },
  async loadUserData() {
    try {
      const user = await dbUtil.getUserByOpenid(this.data.openid)
      if (!user) return
      this.setData({ userInfo: { nickName: user.nickName, avatarUrl: user.avatarUrl }, role: user.role, familyId: user.familyId, isAdmin: user.role==='admin', totalCheckins: user.totalCheckins||0, totalCoins: user.coins||0, totalStepsFormatted: util.formatSteps(user.totalSteps||0), streak: user.streak||0 })
      app.globalData.userInfo = { nickName: user.nickName, avatarUrl: user.avatarUrl }
      if (user.familyId) await this.loadFamilyData()
    } catch (err) { console.error('加载用户数据失败:', err) }
  },
  async loadFamilyData() {
    try {
      const family = await dbUtil.getFamily(this.data.familyId)
      const members = await dbUtil.getFamilyMembers(this.data.familyId)
      this.setData({ familyName: family.name, inviteCode: family.inviteCode, memberCount: members.length, members, isCreator: family.adminOpenid === this.data.openid })
    } catch (err) { console.error('加载家庭数据失败:', err) }
  },
  async getUserProfile() {
    try { const userInfo = await app.getUserProfile(); this.setData({ userInfo }); await dbUtil.getOrCreateUser(this.data.openid, userInfo); await this.loadUserData() }
    catch (err) { console.error('获取用户信息失败:', err) }
  },
  skipProfileSetup() {
    this.setData({ showProfileSetup: false })
    // 创建家庭后还需要显示邀请码
    if (this.data.isCreator && this.data.familyId) {
      setTimeout(() => { this.setData({ showInviteModal: true }) }, 300)
    }
  },
  onChooseAvatar(e) {
    var that = this
    var avatarUrl = e.detail.avatarUrl
    if (!avatarUrl) return
    // 上传头像到云存储
    wx.showLoading({ title: '上传中...' })
    wx.cloud.uploadFile({
      cloudPath: 'avatars/' + that.data.openid + '/' + Date.now() + '.jpg',
      filePath: avatarUrl
    }).then(function(res) {
      var cloudUrl = res.fileID
      var userInfo = that.data.userInfo || {}
      userInfo.avatarUrl = cloudUrl
      that.setData({ userInfo: userInfo })
      app.globalData.userInfo = userInfo
      wx.setStorageSync('userInfo', userInfo)
      // 更新数据库
      return dbUtil.collections.users.where({ openid: that.data.openid }).update({ data: { avatarUrl: cloudUrl } })
    }).then(function() {
      wx.hideLoading()
      wx.showToast({ title: '头像已更新', icon: 'success' })
    }).catch(function(err) {
      wx.hideLoading()
      console.error('上传头像失败:', err)
      wx.showToast({ title: '上传失败', icon: 'none' })
    })
  },
  onNicknameBlur(e) {
    var nickName = (e.detail.value || '').trim()
    if (!nickName) return
    var that = this
    var userInfo = this.data.userInfo || {}
    if (nickName === userInfo.nickName) return
    userInfo.nickName = nickName
    this.setData({ userInfo: userInfo })
    app.globalData.userInfo = userInfo
    wx.setStorageSync('userInfo', userInfo)
    dbUtil.collections.users.where({ openid: this.data.openid }).update({ data: { nickName: nickName } }).then(function() {
      wx.showToast({ title: '昵称已更新', icon: 'success' })
    }).catch(function(err) {
      console.error('更新昵称失败:', err)
    })
  },
  createFamily() {
    wx.showModal({ title: '创建家庭', content: '', editable: true, placeholderText: '给家庭起个名字', confirmText: '创建', confirmColor: '#FF8C42',
      success: async (res) => {
        if (!res.confirm || !res.content) return
        try {
          wx.showLoading({ title: '创建中...' })
          let userInfo = this.data.userInfo; if (!userInfo) userInfo = await app.getUserProfile()
          const user = await dbUtil.getOrCreateUser(this.data.openid, userInfo)
          const family = await dbUtil.createFamily(res.content.trim(), this.data.openid)
          await dbUtil.updateUser(user._id, { role: 'admin', familyId: family._id })
          app.globalData.familyId = family._id; app.globalData.role = 'admin'
          this.setData({ familyId: family._id, role: 'admin', isAdmin: true })
          wx.hideLoading(); wx.showToast({ title: '创建成功', icon: 'success' })
          await this.loadFamilyData()
          // 如果没设置过昵称，先弹引导再弹邀请码
          var ui = this.data.userInfo || {}
          if (!ui.nickName || ui.nickName === '家人' || !ui.avatarUrl) {
            setTimeout(() => { this.setData({ showProfileSetup: true }) }, 1500)
          } else {
            setTimeout(() => { this.setData({ showInviteModal: true }) }, 1500)
          }
        } catch (err) { wx.hideLoading(); wx.showToast({ title: '创建失败', icon: 'none' }) }
      }
    })
  },
  joinFamily() {
    wx.showModal({ title: '加入家庭', content: '', editable: true, placeholderText: '请输入6位邀请码', confirmText: '加入', confirmColor: '#FF8C42',
      success: async (res) => {
        if (!res.confirm || !res.content) return
        const code = res.content.trim().toUpperCase()
        if (code.length !== 6) { wx.showToast({ title: '邀请码为6位', icon: 'none' }); return }
        try {
          wx.showLoading({ title: '加入中...' })
          let userInfo = this.data.userInfo; if (!userInfo) userInfo = await app.getUserProfile()
          const user = await dbUtil.getOrCreateUser(this.data.openid, userInfo)
          const family = await dbUtil.joinFamily(code, this.data.openid)
          await dbUtil.updateUser(user._id, { role: 'member', familyId: family._id })
          app.globalData.familyId = family._id; app.globalData.role = 'member'
          this.setData({ familyId: family._id, role: 'member', isAdmin: false })
          wx.hideLoading(); wx.showToast({ title: '加入成功', icon: 'success' })
          await this.loadFamilyData()
          // 如果没设置过昵称，弹出引导
          var ui = this.data.userInfo || {}
          if (!ui.nickName || ui.nickName === '家人' || !ui.avatarUrl) {
            setTimeout(() => { this.setData({ showProfileSetup: true }) }, 1500)
          }
        } catch (err) { wx.hideLoading(); wx.showToast({ title: err.message||'加入失败', icon: 'none' }) }
      }
    })
  },
  showFamilyInfo() { this.showMembers() },
  showInviteCode() { this.setData({ showInviteModal: true }) },
  hideInviteModal() { this.setData({ showInviteModal: false }) },
  copyInviteCode() { wx.setClipboardData({ data: this.data.inviteCode, success: () => { wx.showToast({ title: '已复制', icon: 'success' }); this.setData({ showInviteModal: false }) } }) },
  showMembers() { this.setData({ showMembersModal: true }) },
  hideMembersModal() { this.setData({ showMembersModal: false }) },
  switchRole() {
    var that = this
    var isAdmin = this.data.isAdmin
    if (!isAdmin && !this.data.isCreator) {
      wx.showToast({ title: '只有家庭创建者可以切换为管理员', icon: 'none' })
      return
    }
    var title = isAdmin ? '切换为成员' : '切换为管理员'
    var content = isAdmin ? '切换后你将无法管理奖品。确定吗？' : '切换后你可以管理奖品。确定吗？'
    var newRole = isAdmin ? 'member' : 'admin'
    wx.showModal({
      title: title,
      content: content,
      confirmText: '确定',
      confirmColor: '#FF8C42',
      success: async function(res) {
        if (!res.confirm) return
        try {
          var user = await dbUtil.getUserByOpenid(that.data.openid)
          await dbUtil.updateUser(user._id, { role: newRole })
          app.globalData.role = newRole
          that.setData({ role: newRole, isAdmin: newRole === 'admin' })
          wx.showToast({ title: '已切换', icon: 'success' })
        } catch(e) {
          console.error('切换角色失败:', e)
          wx.showToast({ title: '切换失败', icon: 'none' })
        }
      }
    })
  },
  toggleLargeText() { const v = !this.data.largeText; this.setData({ largeText: v }); wx.setStorageSync('largeText', v); app.globalData.largeText = v; wx.showToast({ title: v ? '已开启大字模式' : '已关闭大字模式', icon: 'none' }) },
  showAbout() { wx.showModal({ title: '亲情健步', content: '运动连接家人的爱\n让我们一起变得更健康更快乐\n\n1.0版本正式上线', showCancel: false, confirmText: '知道了' }) }
})
