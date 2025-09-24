const app = getApp();

Page({
  data: {
    messageType: 'general',
    title: '',
    content: '',
    contactInfo: '',
    location: '',
    tags: '',
    submitting: false,
    files: [],
    uids: []
  },
  chooseImage: function (e) {
    var that = this;
    wx.chooseImage({
      sizeType: ['original', 'compressed'], // 可以指定是原图还是压缩图，默认二者都有
      sourceType: ['album', 'camera'], // 可以指定来源是相册还是相机，默认二者都有
      success: function (res) {
        // 返回选定照片的本地文件路径列表，tempFilePath可以作为img标签的src属性显示图片
        that.setData({
          files: that.data.files.concat(res.tempFilePaths)
        });
      }
    })
  },
  previewImage: function (e) {
    wx.previewImage({
      current: e.currentTarget.id, // 当前显示图片的http链接
      urls: this.data.files // 需要预览的图片http链接列表
    })
  },
  selectFile(files) {
    console.log('files', files)
    // 返回false可以阻止某次文件上传
  },
  uploadFile(files) {
    // 文件上传的函数，返回一个promise
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url:app.globalData.env.API_BASE_URL + '/api/resources/image?extension=' + files.tempFilePaths[0].split('.').at(-1),
        filePath:files.tempFilePaths[0],
        name:'file',
        success: res=>
          {
            this.data.uids.push(JSON.parse(res.data).uid)
            console.log(this.data.uids)
            resolve({urls:[app.globalData.env.API_BASE_URL + '/api/resources/image?uid='+JSON.parse(res.data).uid]})
          },
        fail:res=>{
          console.log(res)
          reject('upload error')
        }
      })
    })
  },
  uploadError(e) {
    console.log('upload error', e.detail)
  },
  uploadSuccess(e) {
    console.log('upload success', e.detail)
  },

  onLoad() {
    this.setData({
      selectFile: this.selectFile.bind(this),
      uploadFile: this.uploadFile.bind(this),
    })
    // 检查绑定状态
    app.globalData.request({
      url: app.globalData.env.API_BASE_URL + '/api/wechat/isbound',
      success: res => {
        if (!res.data.is_bound) {
          wx.redirectTo({
            url: '/pages/bind/bind'
          });
        }
      }
    });
  },

  // 选择消息类型
  selectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      messageType: type
    });
  },

  // 标题输入
  onTitleInput(e) {
    this.setData({
      title: e.detail.value
    });
  },

  // 内容输入
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    });
  },

  // 联系方式输入
  onContactInput(e) {
    this.setData({
      contactInfo: e.detail.value
    });
  },

  // 位置输入
  onLocationInput(e) {
    this.setData({
      location: e.detail.value
    });
  },

  // 标签输入
  onTagsInput(e) {
    this.setData({
      tags: e.detail.value
    });
  },

  // 提交表单
  onSubmit() {
    if (!this.data.content.trim()) {
      wx.showToast({
        title: '请输入内容',
        icon: 'error'
      });
      return;
    }

    if (this.data.submitting) return;

    this.setData({
      submitting: true
    });

    // 构建请求数据
    const postData = {
      message_type: this.data.messageType,
      content: this.data.content.trim()
    };

    // 添加可选字段
    if (this.data.title.trim()) {
      postData.title = this.data.title.trim();
    }
    if (this.data.contactInfo.trim()) {
      postData.contact_info = this.data.contactInfo.trim();
    }
    if (this.data.location.trim()) {
      postData.location = this.data.location.trim();
    }
    if (this.data.tags.trim()) {
      postData.tags = this.data.tags.trim();
      postData.tags = postData.tags.split('，').join(',');
    }

    // 发布消息
    app.globalData.request({
      url: app.globalData.env.API_BASE_URL + '/api/wall/messages',
      method: 'POST',
      data: postData,
      success: res => {
        wx.showToast({
          title: '发布成功',
          icon: 'success'
        });

        // 返回上一页并刷新
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      },
      fail: err => {
        console.error('发布失败:', err);
        wx.showToast({
          title: '发布失败',
          icon: 'error'
        });
        this.setData({
          submitting: false
        });
      }
    });
  }
});