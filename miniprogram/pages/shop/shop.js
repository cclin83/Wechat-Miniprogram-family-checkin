const app = getApp()
const dbUtil = require('../../utils/db')
const util = require('../../utils/util')
Page({
  data: {
    largeText: wx.getStorageSync("largeText") || false,
    openid: null, userCoins: 0, isAdmin: false, familyId: null, rewards: [], redeemHistory: [],
    showModal: false, editingReward: null, formName: '', formDesc: '', formCoins: '', formType: 'photo', formTextContent: '', formMediaUrl: '', formStock: '1', saving: false,
    showRedeemSuccess: false, redeemedReward: {},
    // 心愿卡
    wishes: [], showWishModal: false, wishContent: '', wishCost: 10,
    wishTemplates: ['一起吃顿饭', '打个视频电话', '一起去散步', '教我用手机', '来家里坐坐'],
    showWishDetail: false, wishDetail: {},
    // 心愿卡价格设置
    showWishPriceModal: false, wishPriceInput: '10'
  },
  async onLoad() {
    try {
      var openid = await app.getOpenid()
      var user = await dbUtil.getUserByOpenid(openid)
      if (user) {
        // 读取管理员设定的心愿卡价格
        var family = user.familyId ? await dbUtil.getFamily(user.familyId) : null
        var wishCost = (family && family.wishCost) ? family.wishCost : 10
        this.setData({ openid: openid, userCoins: user.coins||0, isAdmin: user.role==='admin', familyId: user.familyId, wishCost: wishCost, wishPriceInput: String(wishCost) })
        await this.loadRewards()
        await this.loadWishes()
      }
    } catch(e) { console.error('shop onLoad error:', e) }
  },
  async onShow() {
    this.setData({ largeText: wx.getStorageSync("largeText") || false })
    if (this.data.openid) {
      var user = await dbUtil.getUserByOpenid(this.data.openid)
      if (user) this.setData({ userCoins: user.coins||0, isAdmin: user.role==='admin' })
      await this.loadRewards()
      await this.loadWishes()
    }
  },
  async onPullDownRefresh() { await this.loadRewards(); await this.loadWishes(); var user = await dbUtil.getUserByOpenid(this.data.openid); if (user) this.setData({ userCoins: user.coins||0 }); wx.stopPullDownRefresh() },
  async loadRewards() { if (!this.data.familyId) return; try { this.setData({ rewards: await dbUtil.getRewardList(this.data.familyId) }) } catch(e) { console.error('加载奖品失败:',e) } },
  async loadWishes() { if (!this.data.familyId) return; try { this.setData({ wishes: await dbUtil.getWishList(this.data.familyId) }) } catch(e) { console.error('加载心愿失败:',e) } },
  onRewardTap(e) { const r = this.data.rewards[e.currentTarget.dataset.index]; if (r.type==='text'&&r.textContent) wx.showModal({ title: r.name, content: r.textContent, showCancel: false, confirmText: '知道了' }) },
  onRedeem(e) {
    console.log('[onRedeem] triggered', e.currentTarget.dataset)
    var that = this
    var index = parseInt(e.currentTarget.dataset.index)
    var id = e.currentTarget.dataset.id
    var reward = this.data.rewards[index]
    console.log('[onRedeem] reward:', reward, 'userCoins:', this.data.userCoins)
    if (!reward) { wx.showToast({ title: '奖品数据异常', icon: 'none' }); return }
    if (this.data.userCoins < reward.coinsNeeded) { wx.showToast({ title: '金币不足，继续加油', icon: 'none' }); return }
    if ((reward.redeemed || 0) >= reward.stock) { wx.showToast({ title: '奖品已兑完', icon: 'none' }); return }
    wx.showModal({
      title: '确认兑换',
      content: '花费 ' + reward.coinsNeeded + ' 枚家庭币兑换「' + reward.name + '」？',
      confirmText: '兑换',
      confirmColor: '#FF8C42',
      success: function(res) {
        if (!res.confirm) return
        dbUtil.redeemReward(id, that.data.openid, that.data.userCoins).then(function(rewardData) {
          // 如果有云文件ID，先转临时URL再显示
          if (rewardData.mediaUrl && rewardData.mediaUrl.indexOf('cloud://') === 0) {
            return wx.cloud.getTempFileURL({ fileList: [rewardData.mediaUrl] }).then(function(res) {
              var fileInfo = res.fileList && res.fileList[0]
              if (fileInfo && fileInfo.tempFileURL) {
                rewardData.mediaUrl = fileInfo.tempFileURL
              }
              return rewardData
            })
          }
          return rewardData
        }).then(function(rewardData) {
          that.setData({ userCoins: that.data.userCoins - reward.coinsNeeded, showRedeemSuccess: true, redeemedReward: rewardData })
          var userInfo = app.globalData.userInfo || {}
          return dbUtil.postFeed({ familyId: that.data.familyId, openid: that.data.openid, nickName: userInfo.nickName||'家人', avatarUrl: userInfo.avatarUrl||'', type: 'reward', content: '兑换了奖品「' + reward.name + '」', steps: 0, coins: -reward.coinsNeeded })
        }).then(function() {
          return that.loadRewards()
        }).catch(function(err) {
          console.error('兑换失败:', err)
          wx.showToast({ title: err.message||'兑换失败', icon: 'none' })
        })
      }
    })
  },
  viewReward(e) {
    var that = this
    var index = parseInt(e.currentTarget.dataset.index)
    var reward = this.data.rewards[index]
    if (!reward) return
    // 如果有云文件ID，先转临时URL
    if (reward.mediaUrl && reward.mediaUrl.indexOf('cloud://') === 0) {
      wx.cloud.getTempFileURL({ fileList: [reward.mediaUrl] }).then(function(res) {
        var fileInfo = res.fileList && res.fileList[0]
        var showReward = JSON.parse(JSON.stringify(reward))
        if (fileInfo && fileInfo.tempFileURL) {
          showReward.mediaUrl = fileInfo.tempFileURL
        }
        that.setData({ showRedeemSuccess: true, redeemedReward: showReward })
      })
    } else {
      that.setData({ showRedeemSuccess: true, redeemedReward: reward })
    }
  },
  hideRedeemSuccess() { this.setData({ showRedeemSuccess: false, redeemedReward: {} }) },
  showAddReward() { wx.navigateTo({ url: '/pages/add-reward/add-reward?familyId=' + this.data.familyId + '&openid=' + this.data.openid }) },
  editReward(e) { const r = this.data.rewards[e.currentTarget.dataset.index]; this.setData({ showModal: true, editingReward: r, formName: r.name, formDesc: r.description||'', formCoins: String(r.coinsNeeded), formType: r.type, formTextContent: r.textContent||'', formMediaUrl: r.mediaUrl||'', formStock: String(r.stock) }) },
  hideModal() { this.setData({ showModal: false }) },
  onFormInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  selectType(e) { this.setData({ formType: e.currentTarget.dataset.type }) },
  uploadMedia() {
    const mt = this.data.formType === 'video' ? ['video'] : ['image']
    wx.chooseMedia({ count: 1, mediaType: mt, sourceType: ['album','camera'], sizeType: ['compressed'],
      success: async (res) => {
        try { wx.showLoading({ title: '上传中...' }); const ext = this.data.formType==='video'?'mp4':'jpg'; const u = await wx.cloud.uploadFile({ cloudPath: `rewards/${this.data.familyId}/${Date.now()}.${ext}`, filePath: res.tempFiles[0].tempFilePath }); this.setData({ formMediaUrl: u.fileID }); wx.hideLoading() }
        catch (err) { wx.hideLoading(); wx.showToast({ title: '上传失败', icon: 'none' }) }
      }
    })
  },
  async saveReward() {
    const { formName, formCoins, formType, formStock, familyId, openid } = this.data
    if (!formName.trim()) { wx.showToast({ title: '请输入奖品名称', icon: 'none' }); return }
    if (!formCoins || parseInt(formCoins)<=0) { wx.showToast({ title: '请输入所需金币', icon: 'none' }); return }
    this.setData({ saving: true })
    try {
      const d = { familyId, name: formName.trim(), description: this.data.formDesc.trim(), coinsNeeded: parseInt(formCoins), type: formType, textContent: this.data.formTextContent, mediaUrl: this.data.formMediaUrl, stock: parseInt(formStock)||1, createdBy: openid }
      if (this.data.editingReward) await dbUtil.collections.rewards.doc(this.data.editingReward._id).update({ data: { name: d.name, description: d.description, coinsNeeded: d.coinsNeeded, type: d.type, textContent: d.textContent, mediaUrl: d.mediaUrl, stock: d.stock } })
      else await dbUtil.createReward(d)
      this.setData({ saving: false, showModal: false }); wx.showToast({ title: '保存成功', icon: 'success' }); await this.loadRewards()
    } catch (err) { this.setData({ saving: false }); wx.showToast({ title: '保存失败', icon: 'none' }) }
  },
  deleteReward(e) {
    const { id, index } = e.currentTarget.dataset; const r = this.data.rewards[index]
    wx.showModal({ title: '确认删除', content: `确定删除奖品「${r.name}」吗？`, confirmColor: '#FF4757',
      success: async (res) => { if (!res.confirm) return; try { await dbUtil.collections.rewards.doc(id).update({ data: { active: false } }); wx.showToast({ title: '已删除', icon: 'success' }); await this.loadRewards() } catch(e) { wx.showToast({ title: '删除失败', icon: 'none' }) } }
    })
  },
  playRewardVoice(e) {
    var url = e.currentTarget.dataset.url
    console.log('[playRewardVoice] url:', url)
    if (!url) { wx.showToast({ title: '没有语音文件', icon: 'none' }); return }
    this._playAudio(url)
  },
  previewRewardImage(e) {
    wx.previewImage({ urls: [e.currentTarget.dataset.url] })
  },
  playRedeemVoice() {
    if (!this.data.redeemedReward || !this.data.redeemedReward.mediaUrl) return
    this._playAudio(this.data.redeemedReward.mediaUrl)
  },
  _playAudio(fileIdOrUrl) {
    var that = this
    wx.showLoading({ title: '加载中...' })
    // 如果是云文件ID，先获取临时URL
    if (fileIdOrUrl.indexOf('cloud://') === 0) {
      wx.cloud.getTempFileURL({
        fileList: [fileIdOrUrl],
        success: function(res) {
          wx.hideLoading()
          var fileInfo = res.fileList && res.fileList[0]
          if (fileInfo && fileInfo.tempFileURL) {
            that._doPlay(fileInfo.tempFileURL)
          } else {
            wx.showToast({ title: '获取语音地址失败', icon: 'none' })
          }
        },
        fail: function(err) {
          wx.hideLoading()
          console.error('getTempFileURL fail:', err)
          wx.showToast({ title: '获取语音地址失败', icon: 'none' })
        }
      })
    } else {
      wx.hideLoading()
      that._doPlay(fileIdOrUrl)
    }
  },
  _doPlay(url) {
    console.log('[_doPlay] playing:', url)
    // 停止之前的播放
    if (this._audioCtx) {
      this._audioCtx.stop()
      this._audioCtx.destroy()
    }
    var audio = wx.createInnerAudioContext()
    audio.src = url
    audio.obeyMuteSwitch = false
    audio.onPlay(function() {
      wx.showToast({ title: '播放中...', icon: 'none', duration: 3000 })
    })
    audio.onError(function(err) {
      console.error('audio play error:', err)
      wx.showToast({ title: '播放失败', icon: 'none' })
    })
    audio.play()
    this._audioCtx = audio
  },
  // === 心愿卡 ===
  showWishModal() { this.setData({ showWishModal: true, wishContent: '' }) },
  hideWishModal() { this.setData({ showWishModal: false }) },
  selectWishTemplate(e) { this.setData({ wishContent: e.currentTarget.dataset.text }) },
  onWishInput(e) { this.setData({ wishContent: e.detail.value }) },
  submitWish() {
    var that = this
    var content = this.data.wishContent.trim()
    if (!content) { wx.showToast({ title: '请输入心愿内容', icon: 'none' }); return }
    if (this.data.userCoins < this.data.wishCost) { wx.showToast({ title: '金币不足', icon: 'none' }); return }
    wx.showModal({
      title: '确认许愿',
      content: '花费 ' + this.data.wishCost + ' 枚家庭币许下心愿「' + content + '」？',
      confirmText: '许愿',
      confirmColor: '#FF8C42',
      success: function(res) {
        if (!res.confirm) return
        var userInfo = app.globalData.userInfo || {}
        dbUtil.createWish({
          familyId: that.data.familyId, openid: that.data.openid,
          nickName: userInfo.nickName || '家人', avatarUrl: userInfo.avatarUrl || '',
          content: content, cost: that.data.wishCost
        }).then(function() {
          that.setData({ userCoins: that.data.userCoins - that.data.wishCost, showWishModal: false })
          wx.showToast({ title: '心愿已发出', icon: 'success' })
          // 发动态
          return dbUtil.postFeed({
            familyId: that.data.familyId, openid: that.data.openid,
            nickName: userInfo.nickName || '家人', avatarUrl: userInfo.avatarUrl || '',
            type: 'wish', content: '许下心愿：' + content, steps: 0, coins: -that.data.wishCost
          })
        }).then(function() {
          return that.loadWishes()
        }).catch(function(err) {
          console.error('许愿失败:', err)
          wx.showToast({ title: '许愿失败', icon: 'none' })
        })
      }
    })
  },
  fulfillWish(e) {
    var that = this
    var index = parseInt(e.currentTarget.dataset.index)
    var wish = this.data.wishes[index]
    if (!wish) return
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'],
      success: function(mediaRes) {
        wx.showLoading({ title: '上传中...' })
        wx.cloud.uploadFile({
          cloudPath: 'wishes/' + that.data.familyId + '/' + Date.now() + '.jpg',
          filePath: mediaRes.tempFiles[0].tempFilePath
        }).then(function(uploadRes) {
          var userInfo = app.globalData.userInfo || {}
          return dbUtil.fulfillWish(wish._id, {
            openid: that.data.openid, nickName: userInfo.nickName || '家人',
            photoUrl: uploadRes.fileID
          }).then(function() {
            // 发动态
            return dbUtil.postFeed({
              familyId: that.data.familyId, openid: that.data.openid,
              nickName: userInfo.nickName || '家人', avatarUrl: userInfo.avatarUrl || '',
              type: 'wish_fulfilled', content: '实现了心愿：' + wish.content,
              images: [uploadRes.fileID], steps: 0, coins: 0
            })
          })
        }).then(function() {
          wx.hideLoading()
          wx.showToast({ title: '心愿已实现', icon: 'success' })
          return that.loadWishes()
        }).catch(function(err) {
          wx.hideLoading()
          console.error('实现心愿失败:', err)
          wx.showToast({ title: '操作失败', icon: 'none' })
        })
      }
    })
  },
  fulfillWishDirect(e) {
    var that = this
    var index = parseInt(e.currentTarget.dataset.index)
    var wish = this.data.wishes[index]
    if (!wish) return
    wx.showModal({
      title: '确认实现',
      content: '确定已经实现了心愿「' + wish.content + '」？',
      confirmText: '确认',
      confirmColor: '#4CAF50',
      success: function(res) {
        if (!res.confirm) return
        var userInfo = app.globalData.userInfo || {}
        dbUtil.fulfillWish(wish._id, {
          openid: that.data.openid, nickName: userInfo.nickName || '家人', photoUrl: ''
        }).then(function() {
          return dbUtil.postFeed({
            familyId: that.data.familyId, openid: that.data.openid,
            nickName: userInfo.nickName || '家人', avatarUrl: userInfo.avatarUrl || '',
            type: 'wish_fulfilled', content: '实现了心愿：' + wish.content,
            steps: 0, coins: 0
          })
        }).then(function() {
          wx.showToast({ title: '心愿已实现', icon: 'success' })
          return that.loadWishes()
        }).catch(function(err) {
          console.error('实现心愿失败:', err)
          wx.showToast({ title: '操作失败', icon: 'none' })
        })
      }
    })
  },
  viewWishPhoto(e) {
    var index = parseInt(e.currentTarget.dataset.index)
    var wish = this.data.wishes[index]
    if (!wish || !wish.fulfilledPhoto) return
    var that = this
    if (wish.fulfilledPhoto.indexOf('cloud://') === 0) {
      wx.cloud.getTempFileURL({ fileList: [wish.fulfilledPhoto] }).then(function(res) {
        var f = res.fileList && res.fileList[0]
        if (f && f.tempFileURL) wx.previewImage({ urls: [f.tempFileURL] })
      })
    } else {
      wx.previewImage({ urls: [wish.fulfilledPhoto] })
    }
  },
  // 管理员设置心愿卡价格
  showWishPriceSetting() { this.setData({ showWishPriceModal: true, wishPriceInput: String(this.data.wishCost) }) },
  hideWishPriceModal() { this.setData({ showWishPriceModal: false }) },
  onWishPriceInput(e) { this.setData({ wishPriceInput: e.detail.value }) },
  saveWishPrice() {
    var price = parseInt(this.data.wishPriceInput)
    if (!price || price <= 0) { wx.showToast({ title: '请输入有效价格', icon: 'none' }); return }
    var that = this
    dbUtil.collections.families.where({ _id: this.data.familyId }).update({ data: { wishCost: price } }).then(function() {
      that.setData({ wishCost: price, showWishPriceModal: false })
      wx.showToast({ title: '价格已更新', icon: 'success' })
    }).catch(function() {
      wx.showToast({ title: '保存失败', icon: 'none' })
    })
  },
  preventBubble() {}
})
