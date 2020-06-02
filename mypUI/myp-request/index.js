import { requestConfig } from './common.js'

export default class Request {
	constructor(config={}, reqInterceptor=null, resInterceptor=null, successHandler=null, failHandler=null, completeHandler=null) {
		// base
	    this.baseUrl = config.baseUrl
		if (config.header) {
			// we must parse deep-copy header, then it can not be influenced by the-before request
			this.header = Object.assign({}, config.header) // JSON.parse(JSON.stringify(config.header))
		} else {
			this.header = {"content-type": "application/json;charset=UTF-8"}
		}
		this.success = successHandler
		this.fail = failHandler
		this.complete = completeHandler
		// interceptors
		this.requestInterceptor = reqInterceptor
		this.responseInterceptor = resInterceptor
		if (config.cancelReject && (typeof config.cancelReject === 'object')) {
			this.cancelReject = Object.assign({}, config.cancelReject)
		} else {
			this.cancelReject = {text: '请求未通过验证,检查是否登录或者数据正确', type: 'warning'}
		}
		if (config.failReject && (typeof config.failReject === 'object')) {
			this.failReject = Object.assign({}, config.failReject)
		} else {
			// when null fail reject, it will reject the error info of fail
			this.failReject = null
		}
	}
	// type: request/upload/download.
	// the success/fail/complete handler will not override the global, it will just call after global
	async request(options, successHandler=null, failHandler=null, completeHandler=null) {
		const task = options.task || false
		const type = options.type || "request"
		let config = null
		try{
			config = await requestConfig(this, options)
		}catch(e){
			return Promise.reject(e)
		}
		if (!config || typeof config != 'object') {
			return Promise.reject(this.cancelReject)
		}
		// mypReqToCancel with cancelReject
		if (config.mypReqToCancel) {
			if (config.cancelReject && (typeof config.cancelReject === 'object')) {
				return Promise.reject(config.cancelReject)
			}
			return Promise.reject(this.cancelReject)
		}
		if (config.cancelReject) {
			delete config.cancelReject
		}
		const that = this
		config["success"] = (response) => {
			let _res = null
			if (that.responseInterceptor) {
				_res = that.responseInterceptor(response, options)
			}
			if (_res && _res.mypReqToReject) {
				delete _res.mypReqToReject
				that.fail && that.fail(response)
				failHandler && failHandler(response)
				that.complete && that.complete(response)
				completeHandler && completeHandler(response)
				!task && Promise.reject(_res)
			} else {
				that.success && that.success(response)
				successHandler && successHandler(response)
				that.complete && that.complete(response)
				completeHandler && completeHandler(response)
				!task && Promise.resolve(_res)
			}
		}
		config["fail"] = (response) => {
			that.fail && that.fail(response)
			failHandler && failHandler(response)
			that.complete && that.complete(response)
			completeHandler && completeHandler(response)
			if (config.failReject && (typeof config.failReject === 'object')) {
				!task && Promise.reject(config.failReject)
			} else {
				if (that.failReject) {
					!task && Promise.reject(that.failReject)
				} else {
					// reject the error
					!task && Promise.reject(response)
				}
			}
		}
		if (type === "request") {
			if (task) return uni.request(config);
			uni.request(config)
		} else if (type === "upload") {
			if (task) return uni.uploadFile(config);
			uni.uploadFile(config)
		} else {
			if (task) return uni.downloadFile(config);
			uni.downloadFile(config)
		}
	}
}
