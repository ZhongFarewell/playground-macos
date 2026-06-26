import React from "react";
import { Rnd } from "react-rnd";
import { minMarginX, minMarginY, appBarHeight } from "~/utils";

const FullIcon = ({ size }: { size: number }) => (
  <svg
    className="icon"
    viewBox="0 0 13 13"
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    strokeLinejoin="round"
    strokeMiterlimit={2}
  >
    <path d="M9.26 12.03L.006 2.73v9.3H9.26zM2.735.012l9.3 9.3v-9.3h-9.3z" />
  </svg>
);

const ExitFullIcon = ({ size }: { size: number }) => (
  <svg
    className="icon"
    viewBox="0 0 19 19"
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    strokeLinejoin="round"
    strokeMiterlimit={2}
  >
    <path d="M18.373 9.23L9.75.606V9.23h8.624zM.6 9.742l8.623 8.624V9.742H.599z" />
  </svg>
);

interface TrafficProps {
  id: string;
  max: boolean;
  aspectRatio?: number;
  setMax: (id: string, target?: boolean) => void;
  setMin: (id: string) => void;
  close: (id: string) => void;
}

interface WindowProps extends TrafficProps {
  title: string;
  min: boolean;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  x?: number;
  y?: number;
  z: number;
  focus: (id: string) => void;
  /** 持久化恢复的初始状态（覆盖 props.x/y/width/height 默认值） */
  initialState?: { x: number; y: number; width: number; height: number };
  /** 关闭窗口时回传当前状态（Desktop 用于持久化） */
  onClose?: (state: PersistWindowState) => void;
  children: React.ReactNode;
}

interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
}

/** 持久化的窗口状态（关闭时回传给 Desktop） */
export interface PersistWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  max: boolean;
}

const TrafficLights = ({ id, close, aspectRatio, max, setMax, setMin }: TrafficProps) => {
  const disableMax = aspectRatio !== undefined;

  const closeWindow = (e: React.MouseEvent | React.TouchEvent): void => {
    e.stopPropagation();
    close(id);
  };

  return (
    <div className="traffic-lights flex flex-row absolute left-0 space-x-2 pl-2 mt-1.5">
      <button
        className="window-btn bg-red-500 dark:bg-red-400"
        onClick={closeWindow}
        onTouchEnd={closeWindow}
      >
        <span className="icon i-gg:close text-[9px]" />
      </button>
      <button
        className={`window-btn ${max ? "bg-c-400" : "bg-yellow-500 dark:bg-yellow-400"}`}
        onClick={() => setMin(id)}
        onTouchEnd={() => setMin(id)}
        disabled={max}
      >
        <span className={`icon i-fe:minus text-[10px] ${max ? "invisible" : ""}`} />
      </button>
      <button
        className={`window-btn ${
          disableMax ? "bg-c-400" : "bg-green-500 dark:bg-green-400"
        }`}
        onClick={() => setMax(id)}
        onTouchEnd={() => setMax(id)}
        disabled={disableMax}
      >
        {!disableMax && (max ? <ExitFullIcon size={9} /> : <FullIcon size={6} />)}
      </button>
    </div>
  );
};

const Window = (props: WindowProps) => {
  const dockSize = useStore((state) => state.dockSize);
  const { winWidth, winHeight } = useWindowSize();

  // 初始化：优先用持久化的 initialState，否则用 props 默认值 + clamp 到当前视口
  const initWidth = Math.min(winWidth, props.initialState?.width ?? props.width ?? 640);
  const initHeight = Math.min(
    winHeight,
    props.initialState?.height ?? props.height ?? 400
  );
  const defaultX = winWidth + (winWidth - initWidth) / 2 + (props.x || 0);
  const defaultY = (winHeight - initHeight - dockSize - minMarginY) / 2 + (props.y || 0);

  const [state, setState] = useState<WindowState>({
    width: initWidth,
    height: initHeight,
    x: props.initialState?.x ?? defaultX,
    y: props.initialState?.y ?? defaultY
  });
  // 拖拽/resize 时提升合成层 + 关闭 transition，避免跟手延迟。
  // 全屏切换时 transition 常驻，size/position 平滑过渡（缩放动画）。
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  // 全屏切换过渡期间隐藏内容，避免网格重排抖动影响观感
  const [maximizing, setMaximizing] = useState(false);
  const prevMax = useRef(props.max);

  // 关闭窗口前回传当前状态（Desktop 用于持久化）
  const handleClose = (id: string): void => {
    props.onClose?.({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      max: props.max
    });
    props.close(id);
  };

  useEffect(() => {
    if (prevMax.current !== props.max) {
      prevMax.current = props.max;
      setMaximizing(true);
      const t = setTimeout(() => setMaximizing(false), 150);
      return () => clearTimeout(t);
    }
  }, [props.max]);

  useEffect(() => {
    setState({
      ...state,
      width: Math.min(winWidth, state.width),
      height: Math.min(winHeight, state.height)
    });
  }, [winWidth, winHeight]);

  const round = props.max ? "rounded-none" : "rounded-lg";
  const minimized = props.min
    ? "opacity-0 invisible transition-opacity duration-300"
    : "";
  const border = props.max ? "" : "border border-gray-500/30";
  const width = props.max ? winWidth : state.width;
  const height = props.max ? winHeight : state.height;
  const disableMax = props.aspectRatio !== undefined;

  const children = React.cloneElement(props.children as React.ReactElement, {
    width: width
  });

  return (
    <Rnd
      bounds="parent"
      size={{
        width: width,
        height: height
      }}
      position={{
        x: props.max
          ? winWidth // because of boundary
          : Math.min(
              // "winWidth * 2" because of the boundary for windows
              winWidth * 2 - minMarginX,
              Math.max(
                // "+ winWidth" because we add a boundary for windows
                winWidth - state.width + minMarginX,
                state.x
              )
            ),
        y: props.max
          ? -minMarginY // because of boundary
          : Math.min(
              // "- minMarginY" because of the boundary for windows
              winHeight - minMarginY - (dockSize + 15 + minMarginY),
              Math.max(0, state.y)
            )
      }}
      onDragStart={() => setDragging(true)}
      onDragStop={(e, d) => {
        setState({ ...state, x: d.x, y: d.y });
        setDragging(false);
      }}
      onResizeStart={() => setResizing(true)}
      onResizeStop={(e, direction, ref, delta, position) => {
        setState({
          ...state,
          width: parseInt(ref.style.width),
          height: parseInt(ref.style.height),
          ...position
        });
        setResizing(false);
      }}
      minWidth={props.minWidth ? props.minWidth : 200}
      minHeight={props.minHeight ? props.minHeight : 150}
      dragHandleClassName="window-bar"
      disableDragging={props.max}
      enableResizing={!props.max}
      lockAspectRatio={props.aspectRatio}
      lockAspectRatioExtraHeight={props.aspectRatio ? appBarHeight : undefined}
      style={{
        zIndex: props.z,
        willChange: dragging ? "transform" : "auto",
        transition:
          dragging || resizing
            ? "none"
            : "width 150ms ease-out, height 150ms ease-out, transform 150ms ease-out"
      }}
      onMouseDown={() => props.focus(props.id)}
      className={`overflow-hidden ${round} ${border} shadow-lg shadow-black/30 ${minimized}`}
      id={`window-${props.id}`}
    >
      <div
        className="window-bar relative h-6 text-center bg-c-200"
        onDoubleClick={() => !disableMax && props.setMax(props.id)}
      >
        <TrafficLights
          id={props.id}
          max={props.max}
          aspectRatio={props.aspectRatio}
          setMax={props.setMax}
          setMin={props.setMin}
          close={handleClose}
        />
        <span className="font-semibold text-c-700">{props.title}</span>
      </div>
      <div
        className="innner-window w-full overflow-y-hidden"
        style={{
          opacity: maximizing ? 1 : 1,
          // 淡出瞬间（无 transition），淡入平滑（带 transition），
          // 避免全屏切换时看到网格重排抖动
          transition: maximizing ? "none" : "opacity 120ms ease-out"
        }}
      >
        {children}
      </div>
    </Rnd>
  );
};

export default Window;
