// pages/myrequests/myrequests.js
const app = getApp();
Page({

  /**
   * 页面的初始数据
   */
  data: {
    content: [],
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    loading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.loadRequests();
  },

  /**
   * 加载点歌请求
   */
  loadRequests() {
    this.setData({ loading: true });

    app.globalData.request({
      url: app.globalData.env.API_BASE_URL + "/api/wechat/song/getrequests",
      success: res => {
        const requests = res.data.requests || [];

        // 格式化时间
        const formattedRequests = requests.map(item => ({
          ...item,
          request_time: this.formatTime(item.request_time)
        }));

        // 计算统计数据
        const pendingCount = requests.filter(item => item.status === 'pending').length;
        const approvedCount = requests.filter(item => item.status === 'approved').length;
        const rejectedCount = requests.filter(item => item.status === 'rejected').length;

        this.setData({
          content: formattedRequests,
          pendingCount,
          approvedCount,
          rejectedCount
        });
      },
      fail: () => {
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
        wx.stopPullDownRefresh();
      }
    });
  },

  /**
   * 格式化时间
   */
  formatTime(timeStr) {
    if (!timeStr) return '刚刚';

    try {
      const time = new Date(timeStr);
      const now = new Date();
      const diff = now - time;

      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
      if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
      if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';

      return time.toLocaleDateString();
    } catch (e) {
      return '刚刚';
    }
  },

  /**
   * 跳转到搜索页面
   */
  goToSearch() {
    wx.switchTab({ url: '/pages/songrequest/songrequest' });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadRequests();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    app.globalData.request({
      url: app.globalData.env.API_BASE_URL + '/api/wechat/isbound',
      success: res => {
        if (!res.data.is_bound) {
          wx.redirectTo({ url: '/pages/bind/bind' });
        } else {
          // 如果已绑定，刷新点歌列表
          this.loadRequests();
        }
      }
    });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})