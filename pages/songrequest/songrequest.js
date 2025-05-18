Page({
    data: {
      searchValue: "",
      results: []
    },
    onSearchInput(e) {
      this.setData({ searchValue: e.detail.value });
    },
    onSearch() {
      wx.request({
        url: 'http://127.0.0.1:8000/api/search',
        data: { query: this.data.searchValue },
        success: res => {
            this.setData({ results: res.data.songs });
            for(let i=0;i<this.data.results.length;i++){
                this.data.results[i].artists=this.data.results[i].artists.join(',')
            }
        }
      })
    },
    onShow() {
        const token = wx.getStorageSync('token');
        wx.request({
            url: 'http://127.0.0.1:8000/api/wechat/isbound',
            header: { Authorization: 'Bearer ' + token },
            success: res => {
                if (!res.data.is_bound) {
                    wx.redirectTo({ url: '/pages/bind/bind' });
                }
            }
        })
    },
    onRequestSong(e) {
      const song_id = e.currentTarget.dataset.id;
      console.log(song_id)
      const token = wx.getStorageSync('token');
      wx.request({
        url: 'http://127.0.0.1:8000/api/wechat/song/request',
        method: "POST",
        data: { song_id },
        header: { Authorization: 'Bearer ' + token },
        success: res => {
            const msg = res.data.msg || (res.data.success ? "成功" : res.data.detail);
            wx.showToast({ title: msg, icon: res.data.success ? 'success' : 'none' });
        },
        fail: () => {
            wx.showToast({ title: '网络错误', icon: 'none' });
        }
      })
    }
  })