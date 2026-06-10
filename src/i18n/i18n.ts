type TranslationKey = string;
type TranslationDict = Record<TranslationKey, string>;

const zhCN: TranslationDict = {
	'chat.placeholder': '向 CodeBuddy 发送消息…（Enter 发送，Shift+Enter 换行）',
	'chat.send': '发送',
	'chat.newTab': '新对话',
	'chat.cancel': '停止',
	'chat.planMode': '计划模式',
	'settings.title': 'Codebuddian 设置',
	'settings.cliPath': 'CodeBuddy CLI 路径',
	'settings.model': '模型',
	'settings.permissionMode': '权限模式',
	'approval.title': '需要审批',
	'approval.approve': '批准',
	'approval.deny': '拒绝',
	'error.cliNotFound': '未找到 CodeBuddy CLI，请在设置中配置路径',
	'error.sessionFailed': '会话启动失败',
};

const enUS: TranslationDict = {
	'chat.placeholder': 'Message CodeBuddy… (Enter to send, Shift+Enter for newline)',
	'chat.send': 'Send',
	'chat.newTab': 'New chat',
	'chat.cancel': 'Cancel',
	'chat.planMode': 'Plan mode',
	'settings.title': 'Codebuddian Settings',
	'settings.cliPath': 'CodeBuddy CLI path',
	'settings.model': 'Model',
	'settings.permissionMode': 'Permission mode',
	'approval.title': 'Approval required',
	'approval.approve': 'Approve',
	'approval.deny': 'Deny',
	'error.cliNotFound': 'CodeBuddy CLI not found, please set path in settings',
	'error.sessionFailed': 'Session failed to start',
};

const translations: Record<string, TranslationDict> = {
	'zh-CN': zhCN,
	'en': enUS,
	'en-US': enUS,
};

let currentLocale = 'en';

export function setLocale(locale: string): void {
	currentLocale = locale;
}

export function t(key: TranslationKey, ...args: unknown[]): string {
	const dict = translations[currentLocale] || translations['en'];
	let str = dict[key] || key;
	args.forEach((arg, i) => {
		str = str.replace(`{${i}}`, String(arg));
	});
	return str;
}
