App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: 'your-env-id',
      traceUser: true
    })
    this.globalData = {
      userInfo: null,
      familyId: null,
      role: null,
      openid: null
    }
  },
  getUserProfile() {
    return new Promise((resolve, reject) => {
      const cached = wx.getStorageSync('userInfo')
      if (cached) { this.globalData.userInfo = cached; resolve(cached); return }
      wx.getUserProfile({
        desc: '用于展示家庭成员信息',
        success: res => { this.globalData.userInfo = res.userInfo; wx.setStorageSync('userInfo', res.userInfo); resolve(res.userInfo) },
        fail: reject
      })
    })
  },
  getOpenid() {
    return new Promise((resolve, reject) => {
      if (this.globalData.openid) { resolve(this.globalData.openid); return }
      wx.cloud.callFunction({
        name: 'login',
        success: res => { this.globalData.openid = res.result.openid; resolve(res.result.openid) },
        fail: reject
      })
    })
  }
})
