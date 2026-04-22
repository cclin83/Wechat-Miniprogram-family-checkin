const app = getApp()
const dbUtil = require('../../utils/db')
const util = require('../../utils/util')
Page({
  data: {
    largeText: wx.getStorageSync("largeText") || false,
    openid: null, userCoins: 0, isAdmin: false, familyId: null, rewards: [], redeemHistory: [],
    showModal: false, editingReward: null, formName: '', formDesc: '', formCoins: '', formType: 'photo', formTextContent: '', formMediaUrl: '', formStock: '1', saving: false,
    showRedeemSuccess: false, redeemedReward: {}
  },
  async onLoad() {
    const openid = await app.getOpenid()
    const user = await dbUtil.getUserByOpenid(openid)
    if (user) { this.setData({ openid, userCoins: user.coins||0, isAdmin: user.role==='admin', familyId: user.familyId }); await this.loadRewards() }
  },
  async onShow() {
    this.setData({ largeText: wx.getStorageSync("largeText") || false })
    if (this.data.openid) { const user = await dbUtil.getUserByOpenid(this.data.openid); if (user) this.setData({ userCoins: user.coins||0 }); await this.loadRewards() }
  },
  async onPullDownRefresh() { await this.loadRewards(); const user = await dbUtil.getUserByOpenid(this.data.openid); if (user) this.setData({ userCoins: user.coins||0 }); wx.stopPullDownRefresh() },
  async loadRewards() { if (!this.data.familyId) return; try { this.setData({ rewards: await dbUtil.getRewardList(this.data.familyId) }) } catch(e) { console.error('加载奖品失败:',e) } },
  onRewardTap(e) { const r = this.data.rewards[e.currentTarget.dataset.index]; if (r.type==='text'&&r.textContent) wx.showModal({ title: r.name, content: r.textContent, showCancel: false, confirmText: '知道了' }) },
  async onRedeem(e) {
    const { index, id } = e.currentTarget.dataset; const reward = this.data.rewards[index]
    if (this.data.userCoins < reward.coinsNeeded) { wx.showToast({ title: '金币不足，继续加油', icon: 'none' }); return }
    if (reward.redeemed >= reward.stock) { wx.showToast({ title: '奖品已兑完', icon: 'none' }); return }
    wx.showModal({ title: '确认兑换', content: `花费 ${reward.coinsNeeded} 枚家庭币兑换「${reward.name}」？`, confirmText: '兑换', confirmColor: '#FF8C42',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const rewardData = await dbUtil.redeemReward(id, this.data.openid, this.data.userCoins)
          this.setData({ userCoins: this.data.userCoins - reward.coinsNeeded, showRedeemSuccess: true, redeemedReward: rewardData })
          const userInfo = app.globalData.userInfo || {}
          await dbUtil.postFeed({ familyId: this.data.familyId, openid: this.data.openid, nickName: userInfo.nickName||'家人', avatarUrl: userInfo.avatarUrl||'', type: 'reward', content: `兑换了奖品「${reward.name}」`, steps: 0, coins: -reward.coinsNeeded })
          await this.loadRewards()
        } catch (err) { console.error('兑换失败:',err); wx.showToast({ title: err.message||'兑换失败', icon: 'none' }) }
      }
    })
  },
  hideRedeemSuccess() { this.setData({ showRedeemSuccess: false, redeemedReward: {} }) },
  showAddReward() { this.setData({ showModal: true, editingReward: null, formName: '', formDesc: '', formCoins: '', formType: 'photo', formTextContent: '', formMediaUrl: '', formStock: '1' }) },
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
  preventBubble() {}
})
