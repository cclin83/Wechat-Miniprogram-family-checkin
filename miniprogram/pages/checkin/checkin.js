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
    var cached = wx.getStorageSync("todaySteps"); if (cached && cached.date === util.todayKey() && this.data.steps === 0) { this.setData({ steps: cached.steps, stepsFormatted: util.formatSteps(cached.steps) }); this.drawStepsRing() } this.setData({ largeText: wx.getStorageSync("largeText") || false }); if (this.data.openid) await this.loadTodayData() },
  async loadTodayData() {
    try {
      const checkin = await dbUtil.getTodayCheckin(this.data.openid)
      if (checkin) this.setData({ steps: checkin.steps, stepsFormatted: util.formatSteps(checkin.steps), alreadyChecked: true, selectedMood: checkin.mood||'', postContent: checkin.content||'', postImages: checkin.images||[] })
      this.drawStepsRing()
    } catch (err) { console.error('加载今日数据失败:', err) }
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
  drawStepsRing() {
    const ctx = wx.createCanvasContext('steps-ring', this)
    const s=180, r=160, lw=20, progress=util.calcProgress(this.data.steps,8000), angle=(progress/100)*2*Math.PI
    ctx.beginPath(); ctx.arc(s,s,r,0,2*Math.PI); ctx.setStrokeStyle('#F0E8E0'); ctx.setLineWidth(lw); ctx.setLineCap('round'); ctx.stroke()
    if (progress > 0) {
      ctx.beginPath(); ctx.arc(s,s,r,-Math.PI/2,-Math.PI/2+angle)
      if (this.data.steps>=8000) ctx.setStrokeStyle('#4CAF50')
      else if (this.data.steps>=5000) ctx.setStrokeStyle('#8BC34A')
      else if (this.data.steps>=3000) ctx.setStrokeStyle('#FF8C42')
      else ctx.setStrokeStyle('#FFB380')
      ctx.setLineWidth(lw); ctx.setLineCap('round'); ctx.stroke()
    }
    ctx.draw()
  },
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
      await dbUtil.checkin(this.data.openid, this.data.familyId, { steps: this.data.steps, coins, content: this.data.postContent, images: this.data.postImages, mood: this.data.selectedMood })
      const user = await dbUtil.getUserByOpenid(this.data.openid)
      await dbUtil.updateUser(user._id, { coins: dbUtil._.inc(coins), totalSteps: dbUtil._.inc(this.data.steps), totalCheckins: dbUtil._.inc(this.data.alreadyChecked ? 0 : 1) })
      const userInfo = app.globalData.userInfo || {}
      await dbUtil.postFeed({ familyId: this.data.familyId, openid: this.data.openid, nickName: userInfo.nickName||'家人', avatarUrl: userInfo.avatarUrl||'', type: 'checkin', content: this.data.postContent, images: this.data.postImages, mood: this.data.selectedMood, steps: this.data.steps, coins })
      this.setData({ alreadyChecked: true, checking: false })
      await this.loadCalendar()
      wx.showToast({ title: `打卡成功！+${coins}币`, icon: 'success', duration: 2000 })
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
