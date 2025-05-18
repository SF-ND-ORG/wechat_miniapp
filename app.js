const auth = require('./utils/auth.js')
App({
    onLaunch() {
        auth.checkBindAndRedirect();
    }
})
