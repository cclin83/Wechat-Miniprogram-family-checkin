const app = getApp()
const dbUtil = require('../../utils/db')
const util = require('../../utils/util')
Page({
  data: {
    openid: null, userInfo: null, role: null, familyId: null, isAdmin: false,
    totalCheckins: 0, totalCoins: 0, totalStepsFormatted: '0', streak: 0,
    familyName: '', inviteCode: '', memberCount: 0, members: [],
    showMembersModal: false, showInviteModal: false, largeText: wx.getStorageSync("largeText") || false
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
      this.setData({ familyName: family.name, inviteCode: family.inviteCode, memberCount: members.length, members })
    } catch (err) { console.error('加载家庭数据失败:', err) }
  },
  async getUserProfile() {
    try { const userInfo = await app.getUserProfile(); this.setData({ userInfo }); await dbUtil.getOrCreateUser(this.data.openid, userInfo); await this.loadUserData() }
    catch (err) { console.error('获取用户信息失败:', err) }
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
          setTimeout(() => { this.setData({ showInviteModal: true }) }, 1500)
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
  toggleLargeText() { const v = !this.data.largeText; this.setData({ largeText: v }); wx.setStorageSync('largeText', v); app.globalData.largeText = v; wx.showToast({ title: v ? '已开启大字模式' : '已关闭大字模式', icon: 'none' }) },
  showAbout() { wx.showModal({ title: '亲情健步', content: '用运动连接家人的爱\n\n版本 1.0.0', showCancel: false, confirmText: '知道了' }) }
})
