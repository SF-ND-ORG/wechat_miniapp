const app = getApp();

Page({
    data: {
        userInfo: {},
        nickname: '',
        avatarUrl: '/assets/imgs/default-avatar.png',
        saving: false,
        statusMessage: '',
        statusError: false,
        formattedBindTime: ''
    },

    onLoad() {
        this.fetchProfile();
    },

    onShow() {
        this.fetchProfile();
    },

    fetchProfile() {
        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/userinfo',
            method: 'GET',
            success: res => {
                const data = res.data || {};
                const nickname = data.nickname || data.display_name || data.name || '';
                const avatarUrl = data.avatar_url || '/assets/imgs/default-avatar.png';
                this.setData({
                    userInfo: data,
                    nickname,
                    avatarUrl,
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

    onChooseAvatar(e) {
        const { avatarUrl } = e.detail;
        if (!avatarUrl) return;
        this.setData({ avatarUrl });
    },

    setStatus(message, isError = false) {
        this.setData({
            statusMessage: message,
            statusError: isError
        });
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
        if (!this.validate()) return;

        this.setData({ saving: true });
        this.setStatus('保存中...');

        app.globalData.request({
            url: app.globalData.env.API_BASE_URL + '/api/wechat/profile',
            method: 'PUT',
            data: {
                nickname: this.data.nickname.trim(),
                avatar_url: this.data.avatarUrl
            },
            success: res => {
                const data = res.data || {};
                this.setStatus('保存成功。');
                this.setData({
                    userInfo: data,
                    nickname: data.nickname || data.display_name || data.name || this.data.nickname,
                    avatarUrl: data.avatar_url || this.data.avatarUrl
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
