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
      this.setData({ familyName: family.name, members, totalStepsFormatted: util.formatSteps(totalSteps) })
      setTimeout(() => { members.forEach((member, index) => { this.drawProgressRing(index, member.todaySteps) }) }, 300)
      // 加载排行榜
      try {
        var ranking = await db.getTodayRanking(this.data.familyId)
        this.setData({ ranking: ranking })
      } catch(e) { console.error('加载排行榜失败:', e) }
    } catch (err) { console.error('加载家庭数据失败:', err) }
  },
  drawProgressRing(index, steps) {
    const ctx = wx.createCanvasContext(`ring-${index}`, this)
    const c = 60, r = 55, lw = 8, progress = util.calcProgress(steps, 3000), angle = (progress/100)*2*Math.PI
    ctx.beginPath(); ctx.arc(c,c,r,0,2*Math.PI); ctx.setStrokeStyle('#F0E8E0'); ctx.setLineWidth(lw); ctx.setLineCap('round'); ctx.stroke()
    if (progress > 0) {
      ctx.beginPath(); ctx.arc(c,c,r,-Math.PI/2,-Math.PI/2+angle)
      ctx.setStrokeStyle(progress >= 100 ? '#4CAF50' : progress >= 60 ? '#FF8C42' : '#FFB380')
      ctx.setLineWidth(lw); ctx.setLineCap('round'); ctx.stroke()
    }
    ctx.draw()
  },
  async loadFeed() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ loading: true })
    try {
      const feeds = await db.getFeedList(this.data.familyId, this.data.feedPage)
      const processed = feeds.map(f => ({...f, timeAgo: util.timeAgo(f.createdAt ? new Date(f.createdAt).getTime() : Date.now()), stepsFormatted: util.formatSteps(f.steps), liked: f.likes && f.likes.includes(this.data.openid)}))
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
