const app = getApp();

const DEFAULT_AVATAR = '/assets/imgs/default-avatar.png';
const ALLOWED_AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

Page({
    data: {
        userInfo: {},
        nickname: '',
        avatarUrl: DEFAULT_AVATAR,
        avatarUploading: false,
        avatarChanged: false,
        saving: false,
        statusMessage: '',
        statusError: false,
        formattedBindTime: ''
    },

    onLoad() {
        // 头像上传是异步的，用自增序号丢弃过期上传结果，避免连续选择时串图
        this._avatarUploadSeq = 0;
        this._savedAvatarUrl = DEFAULT_AVATAR;
        this.fetchProfile();
    },

    onShow() {
        this.fetchProfile();
    },

    onUnload() {
        this._clearStatusTimer();
    },

    fetchProfile() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/userinfo',
            method: 'GET',
            success: res => {
                if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                    this.setStatus('加载个人信息失败，请稍后重试。', true);
                    return;
                }
                const data = res.data || {};
                const nickname = data.nickname || data.display_name || data.name || '';
                const avatarUrl = data.avatar_url || DEFAULT_AVATAR;
                this._savedAvatarUrl = avatarUrl;
                this.setData({
                    userInfo: data,
                    nickname,
                    avatarUrl,
                    avatarChanged: false,
                    formattedBindTime: this.formatTime(data.bind_time)
                });
                wx.setStorageSync('userInfo', data);
            },
            fail: () => {
                this.setStatus('加载个人信息失败，请稍后重试。', true);
            }
        });
    },

    formatTime(time) {
        if (!time) return '';
        const date = new Date(time);
        if (Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },

    onNicknameInput(e) {
        this.setData({ nickname: e.detail.value });
    },

    // chooseAvatar 返回的只是当前设备可用的临时路径（wxfile:// 或 http://tmp/...），
    // 不能直接存库，否则其他用户和重启后的自己都看不到；先上传到服务端换成持久地址
    onChooseAvatar(e) {
        const tempPath = e.detail && e.detail.avatarUrl;
        if (!tempPath) return;

        const seq = ++this._avatarUploadSeq;
        // 上传失败时回退到上一次「已经上传成功」或「服务端已保存」的头像；
        // 若上一次还在上传中，它的结果会被序号丢弃，不能作为回退目标
        const previousAvatar = this.data.avatarChanged
            ? this.data.avatarUrl
            : (this._savedAvatarUrl || DEFAULT_AVATAR);
        const cleanPath = tempPath.split('?')[0].split('#')[0];
        const rawExt = (cleanPath.split('.').pop() || '').toLowerCase();
        const extension = ALLOWED_AVATAR_EXTENSIONS.indexOf(rawExt) >= 0 ? rawExt : 'png';

        this.setData({ avatarUrl: tempPath, avatarUploading: true });
        this.setStatus('头像上传中...');

        app.globalData.uploadFile({
            url: app.globalData.env.API_BASE_URL + '/api/resources/image?extension=' + extension,
            filePath: tempPath,
            name: 'file',
            success: res => {
                if (seq !== this._avatarUploadSeq) return;
                let uid = null;
                try {
                    uid = JSON.parse(res.data).uid;
                } catch (err) {
                    uid = null;
                }
                if (!uid) {
                    this.setData({ avatarUrl: previousAvatar, avatarUploading: false });
                    this.setStatus('头像上传失败，请重试。', true);
                    return;
                }
                const avatarUrl = app.globalData.env.API_BASE_URL + '/api/resources/image?uid=' + encodeURIComponent(uid);
                this.setData({
                    avatarUrl,
                    avatarUploading: false,
                    avatarChanged: true
                });
                this.setStatus('头像已上传，点击保存生效。');
            },
            fail: () => {
                if (seq !== this._avatarUploadSeq) return;
                this.setData({ avatarUrl: previousAvatar, avatarUploading: false });
                this.setStatus('头像上传失败，请重试。', true);
            }
        });
    },

    setStatus(message, isError = false) {
        this._clearStatusTimer();
        this.setData({
            statusMessage: message,
            statusError: isError
        });
    },

    // 成功提示只短暂显示，避免一直留在页面上
    flashStatus(message, isError = false, duration = 2000) {
        this.setStatus(message, isError);
        this._statusTimer = setTimeout(() => {
            this._statusTimer = null;
            this.setData({ statusMessage: '' });
        }, duration);
    },

    _clearStatusTimer() {
        if (this._statusTimer) {
            clearTimeout(this._statusTimer);
            this._statusTimer = null;
        }
    },

    validate() {
        if (!this.data.nickname.trim()) {
            this.setStatus('昵称不能为空。', true);
            return false;
        }
        if (this.data.nickname.trim().length > 20) {
            this.setStatus('昵称长度不能超过20个字符。', true);
            return false;
        }
        return true;
    },

    onSave() {
        if (this.data.saving) return;
        if (this.data.avatarUploading) {
            this.setStatus('头像正在上传，请稍候再保存。', true);
            return;
        }
        if (!this.validate()) return;

        // 只有真正换过头像才提交 avatar_url，避免把页面内的默认头像相对路径写进数据库
        const payload = { nickname: this.data.nickname.trim() };
        if (this.data.avatarChanged) {
            payload.avatar_url = this.data.avatarUrl;
        }

        this.setData({ saving: true });
        this.setStatus('保存中...');

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/profile',
            method: 'PUT',
            data: payload,
            success: res => {
                if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                    const message = (res.data && res.data.detail) || '保存失败，请稍后重试。';
                    this.setStatus(message, true);
                    return;
                }
                const data = res.data || {};
                const avatarUrl = data.avatar_url || this.data.avatarUrl || DEFAULT_AVATAR;
                this._savedAvatarUrl = avatarUrl;
                this.flashStatus('保存成功。', false, 2000);
                this.setData({
                    userInfo: data,
                    nickname: data.nickname || data.display_name || data.name || this.data.nickname,
                    avatarUrl,
                    avatarChanged: false
                });
                wx.setStorageSync('userInfo', data);
            },
            fail: err => {
                const message = err?.data?.detail || '保存失败，请稍后重试。';
                this.setStatus(message, true);
            },
            complete: () => {
                this.setData({ saving: false });
            }
        });
    }
});
