const app = getApp()
const dbUtil = require('../../utils/db')

Page({
  data: {
    familyId: null,
    openid: null,
    formName: '',
    formDesc: '',
    formCoins: '30',
    formType: 'photo',
    formTextContent: '',
    formStock: '1',
    saving: false,
    recording: false,
    recorderManager: null,
    mediaList: [],
    uploadProgress: ''
  },

  onLoad: function(options) {
    this.setData({
      familyId: options.familyId || app.globalData.familyId,
      openid: options.openid || app.globalData.openid
    })
  },

  onInput: function(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  selectType: function(e) {
    this.setData({
      formType: e.currentTarget.dataset.type,
      mediaList: [],
      formTextContent: ''
    })
  },

  chooseMedia: function() {
    var that = this
    if (this.data.formType === 'video') {
      wx.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        compressed: true,
        success: function(res) {
          that.setData({ mediaList: that.data.mediaList.concat([{ tempPath: res.tempFilePath, type: 'video' }]) })
        }
      })
    } else {
      var remaining = 9 - this.data.mediaList.length
      if (remaining <= 0) { wx.showToast({ title: '最多9张', icon: 'none' }); return }
      wx.chooseImage({
        count: remaining,
        success: function(res) {
          var items = res.tempFilePaths.map(function(p) { return { tempPath: p, type: 'photo' } })
          that.setData({ mediaList: that.data.mediaList.concat(items) })
        }
      })
    }
  },

  removeMedia: function(e) {
    var list = this.data.mediaList
    list.splice(e.currentTarget.dataset.index, 1)
    this.setData({ mediaList: list })
  },

  previewMedia: function(e) {
    var item = this.data.mediaList[e.currentTarget.dataset.index]
    if (item.type === 'photo') {
      wx.previewImage({
        urls: this.data.mediaList.filter(function(m) { return m.type === 'photo' }).map(function(m) { return m.tempPath }),
        current: item.tempPath
      })
    }
  },

  startRecord: function() {
    var that = this
    var rm = wx.getRecorderManager()
    this.recorderManager = rm
    rm.onStop(function(res) {
      that.setData({
        recording: false,
        mediaList: that.data.mediaList.concat([{ tempPath: res.tempFilePath, type: 'voice' }])
      })
      wx.showToast({ title: '录制成功', icon: 'success' })
    })
    rm.start({ format: 'mp3', duration: 60000 })
    this.setData({ recording: true })
  },

  stopRecord: function() {
    if (this.recorderManager) this.recorderManager.stop()
    this.setData({ recording: false })
  },

  playVoice: function(e) {
    var item = this.data.mediaList[e.currentTarget.dataset.index]
    if (!item) return
    var a = wx.createInnerAudioContext()
    a.src = item.tempPath
    a.play()
  },

  uploadOneFile: function(filePath, ext) {
    var cloudPath = 'rewards/' + Date.now() + '-' + Math.random().toString(36).substr(2, 8) + ext
    return new Promise(function(resolve, reject) {
      wx.cloud.uploadFile({ cloudPath: cloudPath, filePath: filePath, success: function(r) { resolve(r.fileID) }, fail: reject })
    })
  },

  async saveReward() {
    var data = this.data
    if (!data.formName.trim()) { wx.showToast({ title: '请输入奖品名称', icon: 'none' }); return }
    if (!data.formCoins || parseInt(data.formCoins) <= 0) { wx.showToast({ title: '请输入所需金币', icon: 'none' }); return }
    if (data.formType === 'text' && !data.formTextContent.trim()) { wx.showToast({ title: '请输入文字内容', icon: 'none' }); return }
    if (data.formType !== 'text' && data.mediaList.length === 0) { wx.showToast({ title: '请添加媒体文件', icon: 'none' }); return }

    this.setData({ saving: true })
    try {
      if (data.formType === 'text') {
        await dbUtil.createReward({ familyId: data.familyId, name: data.formName.trim(), description: data.formDesc.trim(), coinsNeeded: parseInt(data.formCoins), type: 'text', textContent: data.formTextContent.trim(), mediaUrl: '', stock: parseInt(data.formStock) || 1, createdBy: data.openid })
        this.setData({ saving: false })
        wx.showToast({ title: '添加成功', icon: 'success' })
      } else {
        var total = data.mediaList.length
        for (var i = 0; i < total; i++) {
          var item = data.mediaList[i]
          this.setData({ uploadProgress: '上传中 ' + (i + 1) + '/' + total })
          var ext = item.type === 'video' ? '.mp4' : item.type === 'voice' ? '.mp3' : '.jpg'
          if (item.type === 'photo') { var m = item.tempPath.match(/\.[^.]+$/); if (m) ext = m[0] }
          var cloudUrl = await this.uploadOneFile(item.tempPath, ext)
          var name = total === 1 ? data.formName.trim() : data.formName.trim() + ' ' + (i + 1)
          await dbUtil.createReward({ familyId: data.familyId, name: name, description: data.formDesc.trim(), coinsNeeded: parseInt(data.formCoins), type: data.formType, textContent: '', mediaUrl: cloudUrl, stock: parseInt(data.formStock) || 1, createdBy: data.openid })
        }
        this.setData({ saving: false, uploadProgress: '' })
        wx.showToast({ title: '添加了' + total + '个奖品', icon: 'success' })
      }
      setTimeout(function() { wx.navigateBack() }, 1500)
    } catch (err) {
      console.error('保存失败:', err)
      this.setData({ saving: false, uploadProgress: '' })
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
