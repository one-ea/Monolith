import type { ComponentType } from "react"
import {
  AlertTriangle,
  Apple,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code,
  Copy,
  Droplets,
  Edit,
  ExternalLink,
  Eye,
  FolderOpen,
  Globe,
  GripVertical,
  HardDrive,
  Home,
  ImageIcon,
  Info,
  LayoutDashboard,
  Link as LinkIcon,
  Link2,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  Minus,
  Monitor,
  Moon,
  Palette,
  Pin,
  Plus,
  Save,
  Search,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  StickyNote,
  Sun,
  Trash2,
  X,
} from "lucide-react"

/**
 * Monolith Icon Abstraction（任务书 §14）
 * 业务代码统一 <Icon name="settings" />；当前默认实现为 Lucide，
 * 未来可按 data-theme 映射 SF Symbols / Material Symbols 风格而无需改业务代码。
 * 不引入任何 Apple 私有图标资源。
 */
const ICON_REGISTRY = {
  "alert-triangle": AlertTriangle,
  apple: Apple,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  chart: BarChart3,
  bell: Bell,
  calendar: CalendarDays,
  check: Check,
  "check-circle": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  clock: Clock3,
  code: Code,
  copy: Copy,
  droplets: Droplets,
  edit: Edit,
  "external-link": ExternalLink,
  eye: Eye,
  folder: FolderOpen,
  globe: Globe,
  grip: GripVertical,
  harddrive: HardDrive,
  home: Home,
  image: ImageIcon,
  info: Info,
  dashboard: LayoutDashboard,
  link: LinkIcon,
  link2: Link2,
  loading: LoaderCircle,
  logout: LogOut,
  menu: Menu,
  message: MessageCircle,
  minus: Minus,
  monitor: Monitor,
  moon: Moon,
  palette: Palette,
  pin: Pin,
  plus: Plus,
  save: Save,
  search: Search,
  settings: Settings,
  shield: Shield,
  smartphone: Smartphone,
  sparkles: Sparkles,
  star: Star,
  note: StickyNote,
  sun: Sun,
  trash: Trash2,
  x: X,
} as const

export type IconName = keyof typeof ICON_REGISTRY

const MAPPED_ICONS: Record<IconName, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = ICON_REGISTRY

export function Icon({
  name,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  name: IconName
  className?: string
  "aria-hidden"?: boolean
}) {
  const Component = MAPPED_ICONS[name]
  return <Component className={className} aria-hidden={ariaHidden} />
}
