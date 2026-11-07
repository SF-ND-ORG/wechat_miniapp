const app = getApp();

Page({
  data: {
    files: [],
    isAdmin: false,
    loading: false,
    uploading: false,
    uploadTitle: ''
  },

  onLoad() {
    this.checkAdminStatus();
    this.fetchFiles();
  },

  onShow() {
    this.fetchFiles();
  },

  onPullDownRefresh() {
    this.fetchFiles(() => wx.stopPullDownRefresh(), true);
  },

  checkAdminStatus() {
    app.globalData.request({
      url: app.globalData.env.API_BASE_URL + '/api/wechat/userinfo',
      success: res => {
        this.setData({
          isAdmin: res.data.is_admin || false
        });
      }
    });
  },

  fetchFiles(callback, force = false) {
    if (this.data.loading && !force) {
      if (callback) callback();
      return;
    }
    this.setData({ loading: true });

    app.globalData.request({
      url: app.globalData.env.API_BASE_URL + '/api/grade/list',
      success: res => {
        const items = (res.data.items || []).map(item => ({
          ...item,
          displayTime: this.formatTime(item.created_at),
          extension: this.extractExtension(item.file_name || '')
        }));
        this.setData({ files: items });
      },
      fail: () => {
        wx.showToast({
          title: '加载失败',
          icon: 'error'
        });
      },
      complete: () => {
        this.setData({ loading: false });
        if (callback) callback();
      }
    });
  },

  formatTime(value) {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const pad = num => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  extractExtension(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  },

  handleTitleInput(event) {
    this.setData({ uploadTitle: event.detail.value });
  },

  handleUpload() {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '无权限', icon: 'none' });
      return;
    }

    const title = this.data.uploadTitle.trim();
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xls', 'xlsx'],
      success: res => {
        if (!res.tempFiles || res.tempFiles.length === 0) {
          return;
        }
        const file = res.tempFiles[0];
        const token = wx.getStorageSync('access_token');
        if (!token) {
          wx.showToast({ title: '请重新登录', icon: 'none' });
          return;
        }

        this.setData({ uploading: true });
        wx.showLoading({ title: '上传中', mask: true });

        wx.uploadFile({
          url: app.globalData.env.API_BASE_URL + '/api/grade',
          filePath: file.path,
          name: 'file',
          header: {
            Authorization: 'Bearer ' + token
          },
          formData: {
            title: title
          },
          success: uploadRes => {
            if (uploadRes.statusCode === 401) {
              wx.showToast({ title: '登录已过期', icon: 'none' });
              app.globalData.request({
                url: app.globalData.env.API_BASE_URL + '/api/wechat/isbound'
              });
              return;
            }

            if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
              let payload = null;
              try {
                payload = JSON.parse(uploadRes.data || '{}');
              } catch (err) {
                console.warn('上传响应解析失败', err);
              }
              wx.showToast({ title: '上传成功', icon: 'success' });
              this.setData({ uploadTitle: '' });
              this.fetchFiles(undefined, true);
            } else {
              wx.showToast({ title: '上传失败', icon: 'error' });
            }
          },
          fail: () => {
            wx.showToast({ title: '上传失败', icon: 'error' });
          },
          complete: () => {
            this.setData({ uploading: false });
            wx.hideLoading();
          }
        });
      }
    });
  },

  handlePreview(event) {
    const file = event.detail;
    const token = wx.getStorageSync('access_token');
    if (!token) {
      wx.showToast({ title: '请重新登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '打开中', mask: true });

    wx.downloadFile({
      url: `${app.globalData.env.API_BASE_URL}/api/grade/${file.uid}`,
      header: {
        Authorization: 'Bearer ' + token
      },
      success: res => {
        if (res.statusCode === 401) {
          wx.hideLoading();
          wx.showToast({ title: '登录已过期', icon: 'none' });
          app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/isbound'
          });
          return;
        }

        if (res.statusCode === 200) {
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true,
            fileType: file.extension || 'xlsx',
            success: () => {
              wx.hideLoading();
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '预览失败', icon: 'error' });
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '下载失败', icon: 'error' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '下载失败', icon: 'error' });
      }
    });
  },

  handleDelete(event) {
    if (!this.data.isAdmin) {
      wx.showToast({ title: '无权限', icon: 'none' });
      return;
    }

    const file = event.detail;
    wx.showModal({
      title: '删除确认',
      content: `确定要删除“${file.title}”吗？`,
      success: modalRes => {
        if (!modalRes.confirm) {
          return;
        }

        wx.showLoading({ title: '删除中', mask: true });
        app.globalData.request({
          url: `${app.globalData.env.API_BASE_URL}/api/grade/${file.uid}`,
          method: 'DELETE',
          success: () => {
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.fetchFiles(undefined, true);
          },
          fail: () => {
            wx.showToast({ title: '删除失败', icon: 'error' });
          },
          complete: () => {
            wx.hideLoading();
          }
        });
      }
    });
  }
});