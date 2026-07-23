const app = getApp();
Page({
  data: {
    searchKeyword: "",
    searchValue: "",
    results: [],
    searched: false,
    requestingId: null
  },

  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value,
      searchKeyword: e.detail.value
    });
  },

  onSearch() {
    if (!this.data.searchKeyword.trim()) {
      wx.showToast({ title: '请输入搜索关键词', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '搜索中...' });

    wx.request({
      url: app.globalData.env.API_BASE_URL + '/api/search',
      data: { query: this.data.searchKeyword },
      success: res => {
        const results = res.data.songs || [];
        for (let i = 0; i < results.length; i++) {
          if (results[i].artists && Array.isArray(results[i].artists)) {
            results[i].artists = results[i].artists.join(', ');
          }
        }
        this.setData({
          results: results,
          searched: true
        });
      },
      fail: () => {
        wx.showToast({ title: '搜索失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  onShow() {
    app.globalData.request({
      url: app.globalData.env.API_BASE_URL + '/api/wechat/isbound',
      success: res => {
        if (!res.data.is_bound) {
          wx.redirectTo({ url: '/pages/bind/bind' });
        }
      }
    });
  },

  onRequestSong(e) {
    const song_id = e.currentTarget.dataset.id;
    const song_name = e.currentTarget.dataset.name;

    // 设置请求状态
    this.setData({ requestingId: song_id });

    app.globalData.request({
      url: app.globalData.env.API_BASE_URL + '/api/wechat/song/request',
      method: "POST",
      data: { song_id, song_name },
      success: res => {
        const msg = res.data.msg || (res.data.success ? "点歌成功" : res.data.detail);
        wx.showToast({ title: msg, icon: res.data.success ? 'success' : 'none' });
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        // 清除请求状态
        this.setData({ requestingId: null });
      }
    });
  },

  goToMyRequests() {
    wx.navigateTo({ url: '/pages/myrequests/myrequests' });
  }
})