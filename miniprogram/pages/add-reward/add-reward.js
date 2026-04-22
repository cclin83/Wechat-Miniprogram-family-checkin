const app = getApp()
const dbUtil = require('../../utils/db')

Page({
  data: {
    familyId: null,
    openid: null,
    formName: '',
    formDesc: '',
    formCoins: '',
    formType: 'photo',
    formTextContent: '',
    formMediaUrl: '',
    formStock: '1',
    saving: false
  },

  onLoad(options) {
    this.setData({
      familyId: options.familyId || app.globalData.familyId,
      openid: options.openid || app.globalData.openid
    })
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  selectType(e) {
    this.setData({ formType: e.currentTarget.dataset.type, formMediaUrl: '', formTextContent: '' })
  },

  uploadMedia() {
    var that = this
    var mediaType = this.data.formType === 'video' ? 'video' : 'image'
    if (mediaType === 'image') {
      wx.chooseImage({
        count: 1,
        success: function(res) {
          wx.showLoading({ title: '上传中...' })
          var filePath = res.tempFilePaths[0]
          var cloudPath = 'rewards/' + Date.now() + '-' + Math.random().toString(36).substr(2, 8) + filePath.match(/\.[^.]+$/)[0]
          wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath,
            success: function(uploadRes) {
              that.setData({ formMediaUrl: uploadRes.fileID })
              wx.hideLoading()
            },
            fail: function() {
              wx.hideLoading()
              wx.showToast({ title: '上传失败', icon: 'none' })
            }
          })
        }
      })
    }
  },

  async saveReward() {
    var data = this.data
    if (!data.formName.trim()) {
      wx.showToast({ title: '请输入奖品名称', icon: 'none' })
      return
    }
    if (!data.formCoins || parseInt(data.formCoins) <= 0) {
      wx.showToast({ title: '请输入所需金币', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await dbUtil.createReward({
        familyId: data.familyId,
        name: data.formName.trim(),
        description: data.formDesc.trim(),
        coinsNeeded: parseInt(data.formCoins),
        type: data.formType,
        textContent: data.formTextContent,
        mediaUrl: data.formMediaUrl,
        stock: parseInt(data.formStock) || 1,
        createdBy: data.openid
      })
      this.setData({ saving: false })
      wx.showToast({ title: '添加成功', icon: 'success' })
      setTimeout(function() {
        wx.navigateBack()
      }, 1500)
    } catch (err) {
      console.error('保存奖品失败:', err)
      this.setData({ saving: false })
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
