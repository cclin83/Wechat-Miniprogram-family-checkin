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
    saving: false,
    recording: false,
    recorderManager: null
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
    if (this.data.formType === 'video') {
      wx.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        compressed: true,
        success: function(res) {
          wx.showLoading({ title: '上传中...' })
          var filePath = res.tempFilePath
          var cloudPath = 'rewards/' + Date.now() + '-' + Math.random().toString(36).substr(2, 8) + '.mp4'
          wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath,
            success: function(uploadRes) {
              that.setData({ formMediaUrl: uploadRes.fileID })
              wx.hideLoading()
              wx.showToast({ title: '上传成功', icon: 'success' })
            },
            fail: function() {
              wx.hideLoading()
              wx.showToast({ title: '上传失败', icon: 'none' })
            }
          })
        }
      })
    } else {
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
              wx.showToast({ title: '上传成功', icon: 'success' })
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

  startRecord() {
    var that = this
    var recorderManager = wx.getRecorderManager()
    this.recorderManager = recorderManager
    recorderManager.onStop(function(res) {
      wx.showLoading({ title: '上传中...' })
      var filePath = res.tempFilePath
      var cloudPath = 'rewards/' + Date.now() + '-' + Math.random().toString(36).substr(2, 8) + '.mp3'
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: function(uploadRes) {
          that.setData({ formMediaUrl: uploadRes.fileID })
          wx.hideLoading()
          wx.showToast({ title: '录制成功', icon: 'success' })
        },
        fail: function() {
          wx.hideLoading()
          wx.showToast({ title: '上传失败', icon: 'none' })
        }
      })
    })
    recorderManager.start({ format: 'mp3', duration: 60000 })
    this.setData({ recording: true })
  },

  stopRecord() {
    if (this.recorderManager) {
      this.recorderManager.stop()
    }
    this.setData({ recording: false })
  },

  playVoice() {
    if (!this.data.formMediaUrl) return
    var innerAudioContext = wx.createInnerAudioContext()
    innerAudioContext.src = this.data.formMediaUrl
    innerAudioContext.play()
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
