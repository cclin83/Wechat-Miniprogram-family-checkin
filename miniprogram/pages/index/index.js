const app = getApp()
const db = require('../../utils/db')
const util = require('../../utils/util')
Page({
  data: {
    familyId: null, familyName: '', members: [], totalStepsFormatted: '0',
    openid: null, todayCoins: 0, totalCoins: 0,
    feedList: [], feedPage: 0, hasMore: true, loading: false,
    largeText: wx.getStorageSync("largeText") || false, showCommentInput: false, replyTo: "", commentText: '', commentFeedId: null, commentFeedIndex: null,
    ranking: [], showAllRanking: false
  },
  async onLoad() {
    try {
      if (!db.db) {
        console.log('cloud not ready, show welcome')
        return
      }
      const openid = await app.getOpenid()
      this.setData({ openid })
      const user = await db.getUserByOpenid(openid)
      if (user && user.familyId) {
        app.globalData.familyId = user.familyId
        app.globalData.role = user.role
        this.setData({ familyId: user.familyId, totalCoins: user.coins || 0 })
        await this.loadFamilyData()
        await this.loadFeed()
      }
    } catch (err) { console.error('首页加载失败:', err) }
  },
  async onShow() {
    this.setData({ largeText: wx.getStorageSync("largeText") || false })
    if (this.data.familyId) {
      await this.loadFamilyData()
      this.setData({ feedPage: 0, feedList: [], hasMore: true })
      await this.loadFeed()
      // 未设置头像或昵称时提醒跳转设置
      var user = await db.getUserByOpenid(this.data.openid)
      if (user && (!user.nickName || user.nickName === '家人' || !user.avatarUrl)) {
        wx.showModal({
          title: '完善个人信息',
          content: '设置头像和昵称，让家人认识你吧',
          confirmText: '去设置',
          confirmColor: '#FF8C42',
          success: function(res) {
            if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' })
          }
        })
      }
    }
  },
  async onPullDownRefresh() {
    if (this.data.familyId) {
      await this.loadFamilyData()
      this.setData({ feedPage: 0, feedList: [], hasMore: true })
      await this.loadFeed()
    }
    wx.stopPullDownRefresh()
  },
  async loadFamilyData() {
    try {
      const family = await db.getFamily(this.data.familyId)
      const members = await db.getFamilyMembers(this.data.familyId)
      let totalSteps = 0
      for (let member of members) {
        const checkin = await db.getTodayCheckin(member.openid)
        member.todaySteps = checkin ? checkin.steps : 0
        member.todayStepsFormatted = util.formatSteps(member.todaySteps)
        totalSteps += member.todaySteps
        if (member.openid === this.data.openid) {
          this.setData({ todayCoins: checkin ? checkin.coins : 0, totalCoins: member.coins || 0 })
        }
      }
      // 用已有的members数据生成排行榜，不需要额外查询
      var ranking = members.map(function(m) {
        return { openid: m.openid, nickName: m.nickName || '家人', avatarUrl: m.avatarUrl || '', steps: m.todaySteps || 0 }
      })
      ranking.sort(function(a, b) { return b.steps - a.steps })
      // 批量转换头像 cloud:// URL
      var avatarIds = members.map(function(m) { return m.avatarUrl }).filter(function(u) { return u && u.indexOf('cloud://') === 0 })
      if (avatarIds.length > 0) {
        var urlMap = await util.batchGetTempUrls(avatarIds)
        members.forEach(function(m) { if (urlMap[m.avatarUrl]) m.avatarUrl = urlMap[m.avatarUrl] })
        ranking.forEach(function(r) { if (urlMap[r.avatarUrl]) r.avatarUrl = urlMap[r.avatarUrl] })
      }
      this.setData({ familyName: family.name, members, totalStepsFormatted: util.formatSteps(totalSteps), ranking: ranking })
    } catch (err) { console.error('加载家庭数据失败:', err) }
  },

  async loadFeed() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ loading: true })
    try {
      const feeds = await db.getFeedList(this.data.familyId, this.data.feedPage)
      const processed = feeds.map(f => ({...f, timeAgo: util.timeAgo(f.createdAt ? new Date(f.createdAt).getTime() : Date.now()), stepsFormatted: util.formatSteps(f.steps), liked: f.likes && f.likes.includes(this.data.openid)}))
      // 批量转换动态中的头像和图片
      var allUrls = []
      processed.forEach(function(f) {
        if (f.avatarUrl && f.avatarUrl.indexOf('cloud://') === 0) allUrls.push(f.avatarUrl)
        if (f.images) f.images.forEach(function(img) { if (img && img.indexOf('cloud://') === 0) allUrls.push(img) })
      })
      if (allUrls.length > 0) {
        var urlMap = await util.batchGetTempUrls(allUrls)
        processed.forEach(function(f) {
          if (urlMap[f.avatarUrl]) f.avatarUrl = urlMap[f.avatarUrl]
          if (f.images) f.images = f.images.map(function(img) { return urlMap[img] || img })
        })
      }
      this.setData({ feedList: [...this.data.feedList, ...processed], feedPage: this.data.feedPage+1, hasMore: feeds.length >= 20, loading: false })
    } catch (err) { console.error('加载动态失败:', err); this.setData({ loading: false }) }
  },
  loadMore() { this.loadFeed() },
  async onLike(e) {
    const { id, index } = e.currentTarget.dataset
    const feed = this.data.feedList[index], liked = feed.liked
    try {
      if (liked) { await db.unlikeFeed(id, this.data.openid); feed.likes = feed.likes.filter(u => u !== this.data.openid) }
      else { await db.likeFeed(id, this.data.openid); feed.likes.push(this.data.openid) }
      feed.liked = !liked
      this.setData({ [`feedList[${index}]`]: feed })
    } catch (err) { console.error('点赞失败:', err) }
  },
  onComment(e) {
    const { id, index } = e.currentTarget.dataset
    this.setData({ showCommentInput: true, commentFeedId: id, commentFeedIndex: index, commentText: '', replyTo: '' })
  },
  onReply(e) {
    const { feedId, feedIndex, replyName } = e.currentTarget.dataset
    this.setData({ showCommentInput: true, commentFeedId: feedId, commentFeedIndex: feedIndex, commentText: "", replyTo: replyName })
  },
  hideCommentInput() { this.setData({ showCommentInput: false, replyTo: "" }) },
  onCommentInput(e) { this.setData({ commentText: e.detail.value }) },
  async submitComment() {
    const { commentText, commentFeedId, commentFeedIndex, openid } = this.data
    if (!commentText.trim()) return
    try {
      const userInfo = app.globalData.userInfo || {}
      const comment = { openid, nickName: userInfo.nickName||'家人', avatarUrl: userInfo.avatarUrl||'', content: commentText.trim(), replyTo: this.data.replyTo || '' }
      await db.commentFeed(commentFeedId, comment)
      const feed = this.data.feedList[commentFeedIndex]
      feed.comments.push({...comment, createdAt: Date.now()})
      this.setData({ [`feedList[${commentFeedIndex}]`]: feed, showCommentInput: false, commentText: '' })
      wx.showToast({ title: '评论成功', icon: 'success' })
    } catch (err) { console.error('评论失败:', err); wx.showToast({ title: '评论失败', icon: 'none' }) }
  },
  previewImage(e) { const { urls, current } = e.currentTarget.dataset; wx.previewImage({ urls, current }) },
  onMemberTap(e) { wx.showToast({ title: '查看成员详情', icon: 'none' }) },
  toggleRanking() { this.setData({ showAllRanking: !this.data.showAllRanking }) },
  goCreateFamily() { wx.switchTab({ url: '/pages/profile/profile' }) },
  goJoinFamily() { wx.switchTab({ url: '/pages/profile/profile' }) }
})
