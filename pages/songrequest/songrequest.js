const app = getApp();

const PREVIEW_BITRATE = '320000';
// 网易云账号是会员时 /song/url 会返回完整歌曲，点歌页仍然只试听前 30 秒
const FALLBACK_PREVIEW_SECONDS = 30;

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : (fallback === undefined ? 0 : fallback);
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(toNumber(seconds)));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return minutes + ':' + (remain < 10 ? '0' : '') + remain;
}

Page({
  data: {
    searchKeyword: "",
    searchValue: "",
    results: [],
    searched: false,
    requestingId: null,
    // 试听相关状态
    loadingPreviewId: null,
    previewSongId: null,
    previewPlaying: false,
    previewTrialLabel: ""
  },

  onLoad() {
    // 用于防止快速切换歌曲时，旧请求的结果覆盖新歌曲
    this.previewRequestSeq = 0;
    // 重建音频上下文后，旧上下文的事件不应再影响页面状态
    this.audioGeneration = 0;
    this.preview = null;
    this.initAudioContext();
  },

  onUnload() {
    this.stopPreview();
    this.audioGeneration += 1;
    if (this.audio) {
      this.audio.destroy();
      this.audio = null;
    }
  },

  onHide() {
    if (this.data.loadingPreviewId) {
      // 正在获取地址时离开页面，取消这次试听，避免返回后突然开始播放
      this.stopPreview();
      return;
    }
    if (this.data.previewPlaying && this.audio) {
      this.audio.pause();
    }
  },

  initAudioContext() {
    if (this.audio) return;

    const generation = ++this.audioGeneration;
    const audio = wx.createInnerAudioContext();
    audio.autoplay = false;
    // 用户主动点击试听时，即使手机处于静音模式也播放声音
    audio.obeyMuteSwitch = false;

    audio.onCanplay(() => {
      if (generation !== this.audioGeneration) return;
      this.applyPreviewStart();
    });

    audio.onPlay(() => {
      if (generation !== this.audioGeneration || !this.preview) return;
      this.setData({
        loadingPreviewId: null,
        previewPlaying: true
      });
    });

    audio.onPause(() => {
      if (generation !== this.audioGeneration || !this.preview) return;
      this.setData({ previewPlaying: false });
    });

    audio.onEnded(() => {
      if (generation !== this.audioGeneration) return;
      this.handlePreviewEnded();
    });

    audio.onError(err => {
      if (generation !== this.audioGeneration) return;
      this.handlePreviewError(err);
    });

    audio.onTimeUpdate(() => {
      if (generation !== this.audioGeneration) return;
      this.handlePreviewTimeUpdate();
    });

    this.audio = audio;
  },

  /**
   * 根据 freeTrialInfo 决定从哪里开始播放、到哪里停止。
   *
   * 网易云返回的试听地址通常是截取好的片段（duration 约等于 end - start），
   * 但也可能返回完整歌曲，因此需要结合 duration 判断。
   */
  applyPreviewStart() {
    const preview = this.preview;
    if (!preview || !preview.trial || preview.startApplied) return;

    const trial = preview.trial;
    const duration = toNumber(this.audio.duration);

    if (trial.start <= 0) {
      preview.playEnd = trial.end;
      preview.startApplied = true;
      return;
    }

    // 元数据还没准备好时先等待，onTimeUpdate 会再次调用这里
    if (!duration) return;

    const clipLength = Math.max(0, trial.end - trial.start);
    let offset = 0;

    if (duration > clipLength + 2) {
      // 返回的是完整歌曲，跳到试听片段的起点
      offset = trial.start;
      preview.playEnd = trial.end;
    } else {
      // 返回的已经是截取好的片段，从头播放
      preview.playEnd = Math.min(duration, trial.end);
    }

    preview.startApplied = true;
    if (offset > 0) {
      try {
        this.audio.seek(offset);
      } catch (err) {
        console.warn('试听片段定位失败:', err);
      }
    }
  },

  handlePreviewTimeUpdate() {
    const preview = this.preview;
    if (!preview || !preview.trial || preview.trialEnded) return;

    this.applyPreviewStart();
    if (!preview.startApplied || !preview.playEnd) return;

    if (toNumber(this.audio.currentTime) >= preview.playEnd) {
      this.finishTrial();
    }
  },

  handlePreviewEnded() {
    const preview = this.preview;
    if (!preview) return;
    if (preview.trial) {
      this.finishTrial();
      return;
    }
    this.resetPreviewState();
  },

  handlePreviewError(err) {
    console.warn('试听音频加载失败:', err);
    const preview = this.preview;
    if (!preview) return;
    // 代理地址可能连续触发多次 error，等待回退期间忽略后续事件
    if (preview.fallbackPending) return;

    // 代理地址失败时尝试一次网易云直链，兼容后端尚未部署代理接口的情况。
    // 注意：不能在 onError 回调里同步修改 src，部分基础库会因此抛异常，
    // 这里延迟到下一轮事件循环，并重建一个干净的音频上下文。
    if (preview.usingProxy && !preview.fallbackTried && preview.directUrl) {
      preview.fallbackTried = true;
      preview.fallbackPending = true;
      preview.usingProxy = false;
      const directUrl = preview.directUrl;
      const trial = preview.trial;
      setTimeout(() => {
        if (this.preview !== preview) return;
        preview.fallbackPending = false;
        this.recreateAudioContext();
        this.playPreviewUrl(directUrl, trial);
      }, 0);
      return;
    }

    this.abortPreview('试听加载失败，请稍后重试');
  },

  recreateAudioContext() {
    // 先递增 generation，让旧上下文之后触发的事件全部失效
    this.audioGeneration += 1;
    if (this.audio) {
      try {
        this.audio.destroy();
      } catch (err) {
        console.warn('销毁试听音频上下文失败:', err);
      }
      this.audio = null;
    }
    this.initAudioContext();
  },

  finishTrial() {
    const preview = this.preview;
    if (!preview || preview.trialEnded) return;

    preview.trialEnded = true;
    this.stopAudioOnly();
    this.resetPreviewState();
    wx.showToast({ title: '试听结束，喜欢就点歌吧', icon: 'none' });
  },

  resetPreviewState() {
    this.preview = null;
    this.setData({
      loadingPreviewId: null,
      previewSongId: null,
      previewPlaying: false,
      previewTrialLabel: ""
    });
  },

  abortPreview(message) {
    // 让还在路上的请求失效
    this.previewRequestSeq += 1;
    this.stopAudioOnly();
    this.resetPreviewState();
    if (message) {
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  stopAudioOnly() {
    if (!this.audio) return;
    try {
      this.audio.stop();
    } catch (err) {
      console.warn('停止试听失败:', err);
    }
  },

  stopPreview() {
    this.previewRequestSeq += 1;
    this.stopAudioOnly();
    this.resetPreviewState();
  },

  playPreviewUrl(url, trial) {
    const preview = this.preview;
    if (!preview || !url) return;

    preview.startApplied = false;
    preview.playEnd = trial ? trial.end : 0;

    this.stopAudioOnly();
    const audio = this.audio;
    try {
      audio.startTime = 0;
      audio.src = url;
    } catch (err) {
      this.handlePreviewError(err);
      return;
    }

    this.setData({
      loadingPreviewId: preview.songId,
      previewPlaying: false
    });

    try {
      audio.play();
    } catch (err) {
      this.handlePreviewError(err);
    }
  },

  startPreview(song) {
    const songId = String(song.id);
    const seq = ++this.previewRequestSeq;

    this.stopAudioOnly();
    this.preview = {
      songId,
      directUrl: "",
      usingProxy: true,
      fallbackTried: false,
      fallbackPending: false,
      trial: null,
      startApplied: false,
      playEnd: 0,
      trialEnded: false
    };

    this.setData({
      loadingPreviewId: songId,
      previewSongId: songId,
      previewPlaying: false,
      previewTrialLabel: ""
    });

    const apiBase = app.globalData.env.API_BASE_URL.replace(/\/+$/, '');

    wx.request({
      url: apiBase + '/api/geturl',
      method: 'GET',
      data: {
        id: songId,
        br: PREVIEW_BITRATE
      },
      success: res => {
        if (seq !== this.previewRequestSeq || !this.preview) return;

        const payload = (res && res.data) || {};
        const info = payload.data || {};
        const directUrl = info.url || '';

        if (res.statusCode === 429) {
          this.abortPreview('请求过多，请稍后再试');
          return;
        }

        if (res.statusCode !== 200 || Number(payload.code) !== 200 || !directUrl) {
          this.abortPreview('该歌曲暂时无法试听');
          return;
        }

        const trialRaw = info.free_trial_info;
        let trial = null;
        if (trialRaw && toNumber(trialRaw.end) > 0) {
          const start = Math.max(0, toNumber(trialRaw.start));
          const end = toNumber(trialRaw.end);
          trial = end > start
            ? { start, end }
            : { start: 0, end: FALLBACK_PREVIEW_SECONDS };
        } else {
          trial = { start: 0, end: FALLBACK_PREVIEW_SECONDS };
        }

        const streamPath = info.stream_url || '';
        const useProxy = Boolean(streamPath);
        const playUrl = useProxy
          ? (/^https?:\/\//i.test(streamPath) ? streamPath : apiBase + streamPath)
          : directUrl;

        this.preview.directUrl = directUrl;
        this.preview.trial = trial;
        this.preview.usingProxy = useProxy;
        // 后端未返回 stream_url（旧版本）时直接播放直链，不再尝试必然 404 的代理地址
        this.preview.fallbackTried = !useProxy;

        this.setData({
          previewTrialLabel: trial
            ? '试听片段 ' + formatClock(trial.start) + '-' + formatClock(trial.end)
            : ""
        });

        this.playPreviewUrl(playUrl, trial);
      },
      fail: () => {
        if (seq !== this.previewRequestSeq) return;
        this.abortPreview('网络错误，无法获取试听');
      }
    });
  },

  onPreviewTap(e) {
    const songId = String(e.currentTarget.dataset.id);
    const song = (this.data.results || []).find(item => String(item.id) === songId);
    if (!song) return;

    if (this.data.loadingPreviewId === songId) return;

    if (this.preview && this.preview.songId === songId) {
      if (this.data.previewPlaying) {
        this.audio.pause();
      } else {
        this.setData({ loadingPreviewId: songId });
        try {
          this.audio.play();
        } catch (err) {
          this.handlePreviewError(err);
        }
      }
      return;
    }

    this.startPreview(song);
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

    // 重新搜索时停止当前试听
    this.stopPreview();
    wx.showLoading({ title: '搜索中...' });

    wx.request({
      url: app.globalData.env.API_BASE_URL + '/api/search',
      data: { query: this.data.searchKeyword },
      success: res => {
        if (res.statusCode !== 200) {
          wx.showToast({
            title: (res.data && res.data.detail) || '搜索失败',
            icon: 'none'
          });
          return;
        }

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
});
