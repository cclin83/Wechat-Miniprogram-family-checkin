App({
  onLaunch() {
    try {
      if (wx.cloud) {
        wx.cloud.init({
          env: 'cloud1-d1g0ayrh448486ce1',
          traceUser: true
        })
      }
    } catch (e) {
      console.log('cloud init skip', e)
    }
    this.globalData = {
      userInfo: null,
      familyId: null,
      role: null,
      openid: null,
      largeText: wx.getStorageSync('largeText') || false
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
