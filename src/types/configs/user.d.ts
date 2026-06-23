export interface UserData {
  name: string;
  avatar: string;
  /**
   * 已废弃：早期 mock 登录用明文密码，保留仅为兼容。
   * 现在走真实接口后不再使用，登录密码由 Login 页输入、与后端 Users 表校验。
   */
  password: string;
  /**
   * 登录用户名，对应后端 Users 表的 username 字段。
   * 登录页只输密码，用户名从这里读取（固定单一管理员账号）。
   */
  username: string;
}
