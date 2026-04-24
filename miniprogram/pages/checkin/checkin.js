const app = getApp()
const dbUtil = require('../../utils/db')
const util = require('../../utils/util')
Page({
  data: {
    largeText: wx.getStorageSync("largeText") || false,
    steps: 0, stepsFormatted: '0', syncing: false, lastSyncTime: '',
    alreadyChecked: false, checking: false,
    selectedMood: '', postContent: '', postImages: [], moodTags: util.MOOD_TAGS,
    calendarYear: new Date().getFullYear(), calendarMonth: new Date().getMonth(), calendar: [], streak: 0,
    monthCheckins: 0, monthCoins: 0, monthStepsFormatted: '0',
    openid: null, familyId: null
  },
  async onLoad() {
    var cached = wx.getStorageSync("todaySteps")
    if (cached && cached.date === util.todayKey()) {
      this.setData({ steps: cached.steps, stepsFormatted: util.formatSteps(cached.steps) })
      this.drawStepsRing()
    }
    const openid = await app.getOpenid()
    const user = await dbUtil.getUserByOpenid(openid)
    this.setData({ openid, familyId: user ? user.familyId : null })
    await this.loadTodayData()
    await this.loadCalendar()
  },
  async onShow() {
    var cached = wx.getStorageSync("todaySteps"); if (cached && cached.date === util.todayKey()) { this.setData({ steps: cached.steps, stepsFormatted: util.formatSteps(cached.steps), largeText: wx.getStorageSync("largeText") || false }) } else { this.setData({ largeText: wx.getStorageSync("largeText") || false }) } var that = this; setTimeout(function() { that.drawStepsRing() }, 100) },
  async loadTodayData() {
    try {
      var checkin = await dbUtil.getTodayCheckin(this.data.openid)
      if (checkin) {
        this.setData({ steps: checkin.steps, stepsFormatted: util.formatSteps(checkin.steps), alreadyChecked: true })
        this.drawStepsRing()
      }
    } catch (err) {
      console.error('loadTodayData error:', err)
    }
  },
  syncSteps() {
    if (this.data.syncing) return
    this.setData({ syncing: true })
    var that = this
    wx.getWeRunData({
      success: function(res) {
        wx.cloud.callFunction({
          name: 'syncSteps',
          data: {
            weRunData: wx.cloud.CloudID(res.cloudID)
          },
          success: function(callRes) {
            var stepData = callRes.result
            if (stepData && stepData.stepInfoList) {
              var todayData = stepData.stepInfoList[stepData.stepInfoList.length - 1]
              var steps = todayData ? todayData.step : 0
              var coins = util.calcCoins(steps)
              that.setData({ steps: steps, stepsFormatted: util.formatSteps(steps), lastSyncTime: util.formatTime(new Date()), syncing: false }); wx.setStorageSync('todaySteps', { steps: steps, date: util.todayKey() })
              that.drawStepsRing()
              if (coins > 0) wx.showToast({ title: steps + '步，可获' + coins + '枚币', icon: 'none', duration: 2000 })
            } else {
              that.setData({ syncing: false })
              wx.showToast({ title: '同步失败', icon: 'none' })
            }
          },
          fail: function(err) {
            console.error('同步步数失败:', err)
            that.setData({ syncing: false })
            wx.showToast({ title: '同步失败，请重试', icon: 'none' })
          }
        })
      },
      fail: function(err) {
        that.setData({ syncing: false })
        if (err.errMsg && err.errMsg.indexOf('authorize') >= 0) {
          wx.showModal({ title: '需要授权', content: '请允许获取微信运动数据', confirmText: '去授权', success: function(r) { if (r.confirm) wx.openSetting() } })
        } else {
          wx.showToast({ title: '获取步数失败', icon: 'none' })
        }
      }
    })
  },
  drawStepsRing() { /* 已移除canvas画环 */ },
  selectMood(e) { const mood = e.currentTarget.dataset.mood; this.setData({ selectedMood: this.data.selectedMood === mood ? '' : mood }) },
  onPostInput(e) { this.setData({ postContent: e.detail.value }) },
  chooseImage() {
    wx.chooseMedia({ count: 3-this.data.postImages.length, mediaType: ['image'], sourceType: ['album','camera'], sizeType: ['compressed'],
      success: async (res) => {
        const imgs = [...this.data.postImages]
        for (const file of res.tempFiles) {
          try { const u = await wx.cloud.uploadFile({ cloudPath: `checkin/${this.data.openid}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`, filePath: file.tempFilePath }); imgs.push(u.fileID) }
          catch (err) { console.error('上传图片失败:', err) }
        }
        this.setData({ postImages: imgs })
      }
    })
  },
  deleteImage(e) { const imgs = [...this.data.postImages]; imgs.splice(e.currentTarget.dataset.index, 1); this.setData({ postImages: imgs }) },
  async doCheckin() {
    if (this.data.checking) return
    // 不限制步数，随时可以打卡
    if (!this.data.familyId) { wx.showToast({ title: '请先加入家庭', icon: 'none' }); return }
    this.setData({ checking: true })
    try {
      const coins = util.calcCoins(this.data.steps)
      const result = await dbUtil.checkin(this.data.openid, this.data.familyId, { steps: this.data.steps, coins, content: this.data.postContent, images: this.data.postImages, mood: this.data.selectedMood })
      // 用差值更新，避免重复累加
      const coinsDiff = coins - result.prevCoins
      const stepsDiff = this.data.steps - result.prevSteps
      const user = await dbUtil.getUserByOpenid(this.data.openid)
      await dbUtil.updateUser(user._id, { coins: dbUtil._.inc(coinsDiff), totalSteps: dbUtil._.inc(stepsDiff), totalCheckins: dbUtil._.inc(result.updated ? 0 : 1) })
      const userInfo = app.globalData.userInfo || {}
      await dbUtil.postFeed({ familyId: this.data.familyId, openid: this.data.openid, nickName: userInfo.nickName||'家人', avatarUrl: userInfo.avatarUrl||'', type: 'checkin', content: this.data.postContent, images: this.data.postImages, mood: this.data.selectedMood, steps: this.data.steps, coins })
      this.setData({ alreadyChecked: true, checking: false, selectedMood: '', postContent: '', postImages: [] })
      await this.loadCalendar()
      wx.showToast({ title: coinsDiff > 0 ? `打卡成功！+${coinsDiff}币` : '打卡成功！', icon: 'success', duration: 2000 })
    } catch (err) { console.error('打卡失败:', err); this.setData({ checking: false }); wx.showToast({ title: '打卡失败，请重试', icon: 'none' }) }
  },
  async loadCalendar() {
    try {
      const { calendarYear, calendarMonth, openid } = this.data
      const records = await dbUtil.getMonthCheckins(openid, calendarYear, calendarMonth)
      const checkinDays = records.map(r => r.date)
      const calendar = util.generateCalendar(calendarYear, calendarMonth, checkinDays)
      let monthCoins = 0, monthSteps = 0
      records.forEach(r => { monthCoins += r.coins||0; monthSteps += r.steps||0 })
      this.setData({ calendar, streak: util.calcStreak(checkinDays), monthCheckins: records.length, monthCoins, monthStepsFormatted: util.formatSteps(monthSteps) })
    } catch (err) { console.error('加载日历失败:', err) }
  },
  prevMonth() { let {calendarYear:y, calendarMonth:m} = this.data; m--; if(m<0){m=11;y--}; this.setData({calendarYear:y,calendarMonth:m}); this.loadCalendar() },
  nextMonth() { let {calendarYear:y, calendarMonth:m} = this.data; const n=new Date(); if(y>=n.getFullYear()&&m>=n.getMonth()) return; m++; if(m>11){m=0;y++}; this.setData({calendarYear:y,calendarMonth:m}); this.loadCalendar() }
})
