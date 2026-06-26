/**
 * 右键菜单协议接口
 *
 * 这是 App 与主应用之间的"固定通信格式"。
 * 无论 App 是内置 React 组件还是未来独立打包的模块，都通过这个接口声明右键菜单项。
 * 独立打包的 App 只需遵守此接口即可接入主应用的右键菜单系统。
 */

export interface MenuItemDef {
  /** 唯一 key，用于 React 渲染 */
  key?: string;
  /** 菜单项显示文本 */
  label?: string;
  /** 快捷键提示，如 "⌘C"、"⌘V" */
  shortcut?: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 是否禁用（灰色不可点） */
  disabled?: boolean;
  /** 是否分隔线（为 true 时其他字段忽略） */
  separator?: boolean;
  /** 是否选中（显示 ✓，用于排序/视图等可切换项） */
  checked?: boolean;
  /** 子菜单（macOS 支持二级菜单，预留） */
  children?: MenuItemDef[];
}

/**
 * 菜单项收集器
 *
 * 右键事件冒泡时，冒泡路径上的元素/App 通过此收集器声明自己的菜单项。
 * 收集顺序：从最内层元素到外层 App，最终按顺序拼接成完整菜单。
 */
export interface MenuCollector {
  /** 追加一组菜单项 */
  add: (...items: MenuItemDef[]) => void;
  /** 追加一个分隔线 */
  addSeparator: () => void;
}

/**
 * 右键菜单上下文信息
 *
 * 传递给收集回调，让元素能根据上下文决定返回哪些菜单项。
 */
export interface ContextMenuContext {
  /** 原始鼠标事件 */
  event: MouseEvent;
  /** 右键点击的 X 坐标（视口） */
  x: number;
  /** 右键点击的 Y 坐标（视口） */
  y: number;
  /** 当前选中的文本（如有） */
  selection: string;
  /** 事件目标元素 */
  target: HTMLElement;
}
