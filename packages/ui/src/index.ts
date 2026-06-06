// Utility
export { cn } from './lib/utils'

// UI primitives
export { Button, buttonVariants } from './components/ui/button'
export type { ButtonProps } from './components/ui/button'

export { Badge, badgeVariants } from './components/ui/badge'
export type { BadgeProps } from './components/ui/badge'

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/ui/card'

export { Separator } from './components/ui/separator'

export { Skeleton } from './components/ui/skeleton'

export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs'

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './components/ui/dropdown-menu'

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './components/ui/tooltip'

// Manufacturing components
export { StatusBadge } from './components/manufacturing/status-badge'
export type { StatusBadgeProps, StatusBadgeVariant } from './components/manufacturing/status-badge'

export { LifecycleBadge } from './components/manufacturing/lifecycle-badge'
export type {
  LifecycleBadgeProps,
  LifecycleBadgeVariant,
} from './components/manufacturing/lifecycle-badge'

export { OwnerBadge } from './components/manufacturing/owner-badge'
export type { OwnerBadgeProps } from './components/manufacturing/owner-badge'

export { ConfidenceIndicator } from './components/manufacturing/confidence-indicator'
export type { ConfidenceIndicatorProps } from './components/manufacturing/confidence-indicator'

export { FreshnessIndicator } from './components/manufacturing/freshness-indicator'
export type { FreshnessIndicatorProps } from './components/manufacturing/freshness-indicator'

export { DrillThroughButton } from './components/manufacturing/drill-through-button'
export type { DrillThroughButtonProps } from './components/manufacturing/drill-through-button'

export { EmptyState } from './components/manufacturing/empty-state'
export type { EmptyStateProps } from './components/manufacturing/empty-state'

export { ErrorState } from './components/manufacturing/error-state'
export type { ErrorStateProps } from './components/manufacturing/error-state'

export { LoadingState } from './components/manufacturing/loading-state'
export type { LoadingStateProps } from './components/manufacturing/loading-state'

export { CommandPalette } from './components/manufacturing/command-palette'
export type {
  CommandPaletteProps,
  CommandPaletteItem,
} from './components/manufacturing/command-palette'

export { VerificationStatusBanner } from './components/manufacturing/verification-status-banner'
export type {
  VerificationStatusBannerProps,
  VerificationStatus,
} from './components/manufacturing/verification-status-banner'

export { SourceModeBadge } from './components/manufacturing/source-mode-badge'
export type {
  SourceModeBadgeProps,
  ExtendedSourceMode,
} from './components/manufacturing/source-mode-badge'

export { EvidenceStatusBadge } from './components/manufacturing/evidence-status-badge'
export type {
  EvidenceStatusBadgeProps,
  EvidenceStatus,
} from './components/manufacturing/evidence-status-badge'

export { SourceConfidenceStrip } from './components/manufacturing/source-confidence-strip'
export type { SourceConfidenceStripProps } from './components/manufacturing/source-confidence-strip'

export { PartialDataNotice } from './components/manufacturing/partial-data-notice'
export type { PartialDataNoticeProps } from './components/manufacturing/partial-data-notice'

export { UnavailableValue } from './components/manufacturing/unavailable-value'
export type { UnavailableValueProps } from './components/manufacturing/unavailable-value'

export { UnknownValue } from './components/manufacturing/unknown-value'
export type { UnknownValueProps } from './components/manufacturing/unknown-value'

export { NotEvaluatedValue } from './components/manufacturing/not-evaluated-value'
export type { NotEvaluatedValueProps } from './components/manufacturing/not-evaluated-value'

export { CaveatBadge } from './components/manufacturing/caveat-badge'
export type { CaveatBadgeProps } from './components/manufacturing/caveat-badge'

export { ApplicationHeuristicBadge } from './components/manufacturing/application-heuristic-badge'
export type { ApplicationHeuristicBadgeProps } from './components/manufacturing/application-heuristic-badge'

export { GovernancePendingBadge } from './components/manufacturing/governance-pending-badge'
export type { GovernancePendingBadgeProps } from './components/manufacturing/governance-pending-badge'

export { PendingValidationBadge } from './components/manufacturing/pending-validation-badge'
export type { PendingValidationBadgeProps } from './components/manufacturing/pending-validation-badge'

export { ApplicationDerivedBadge } from './components/manufacturing/application-derived-badge'
export type { ApplicationDerivedBadgeProps } from './components/manufacturing/application-derived-badge'

export { SourceBackedBadge } from './components/manufacturing/source-backed-badge'
export type { SourceBackedBadgeProps } from './components/manufacturing/source-backed-badge'

export { SourceBadge } from './components/manufacturing/source-badge'
export type { SourceBadgeProps } from './components/manufacturing/source-badge'
