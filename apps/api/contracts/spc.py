"""
Manual Pydantic contracts for SPC Native Routes.

WARNING: This is a temporary bridge. The canonical source of truth for these
contracts is packages/data-contracts/src/schemas/spc-monitoring.ts.
Currently the generated contracts pipeline does not fully support the complex
nested structures needed for the native chart data response.

TODO: Move these models into the standard export-json-schema.ts / datamodel-codegen
pipeline once it supports these shapes.
"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

# Enums
Severity = Literal['low', 'medium', 'high', 'critical']

ChartType = Literal[
    'xbar-r',
    'xbar-s',
    'individuals',
    'p-chart',
    'np-chart',
    'c-chart',
    'u-chart',
    'ewma',
    'cusum',
]

LimitProvenance = Literal[
    'mock-fixture',
    'calculated-from-sample',
    'imported-from-approved-source',
    'unknown',
]

ApprovalState = Literal[
    'approved',
    'not-approved',
    'pending-validation',
    'unavailable',
]

class MonitoredSPCCharacteristic(BaseModel):
    characteristic_id: str = Field(..., alias='characteristicId')
    characteristic_name: str = Field(..., alias='characteristicName')
    mic_id: Optional[str] = Field(None, alias='micId')
    chart_type: ChartType = Field(..., alias='chartType')
    batch_count: int = Field(..., alias='batchCount', ge=0)
    avg_samples_per_batch: Optional[float] = Field(None, alias='avgSamplesPerBatch')
    has_active_signal: bool = Field(..., alias='hasActiveSignal')
    highest_signal_severity: Optional[Severity] = Field(None, alias='highestSignalSeverity')
    operation_id: Optional[str] = Field(None, alias='operationId')
    chart_type_source: Optional[Literal['heuristic', 'override', 'manual']] = Field(None, alias='chartTypeSource')

class SPCMonitoringContext(BaseModel):
    plant_id: str = Field(..., alias='plantId')
    plant_name: str = Field(..., alias='plantName')
    material_id: str = Field(..., alias='materialId')
    material_description: str = Field(..., alias='materialDescription')
    batch_id: Optional[str] = Field(None, alias='batchId')
    work_centre_id: Optional[str] = Field(None, alias='workCentreId')
    operation_id: Optional[str] = Field(None, alias='operationId')
    characteristic_id: Optional[str] = Field(None, alias='characteristicId')
    chart_type: Optional[ChartType] = Field(None, alias='chartType')
    active_signals: int = Field(..., alias='activeSignals', ge=0)
    highest_severity: Severity = Field(..., alias='highestSeverity')
    last_updated_at: datetime = Field(..., alias='lastUpdatedAt')
    active_scope: Optional[str] = Field(None, alias='activeScope')
    active_view: Optional[str] = Field(None, alias='activeView')

class SPCSummary(BaseModel):
    charts_monitored: int = Field(..., alias='chartsMonitored', ge=0)
    active_signals: int = Field(..., alias='activeSignals', ge=0)
    out_of_control_signals: int = Field(..., alias='outOfControlSignals', ge=0)
    warning_signals: int = Field(..., alias='warningSignals', ge=0)
    characteristics_at_risk: int = Field(..., alias='characteristicsAtRisk', ge=0)
    highest_severity: Severity = Field(..., alias='highestSeverity')
    recommended_action: str = Field(..., alias='recommendedAction')
    confidence: float = Field(..., ge=0, le=1)

class SPCSignal(BaseModel):
    signal_id: str = Field(..., alias='signalId')
    characteristic_id: str = Field(..., alias='characteristicId')
    characteristic_name: str = Field(..., alias='characteristicName')
    material_id: str = Field(..., alias='materialId')
    batch_id: str = Field(..., alias='batchId')
    plant_id: str = Field(..., alias='plantId')
    chart_type: ChartType = Field(..., alias='chartType')
    rule: str = Field(..., alias='rule')
    rule_code: Optional[str] = Field(None, alias='ruleCode')
    severity: Severity = Field(..., alias='severity')
    detected_at: datetime = Field(..., alias='detectedAt')
    sample_point_id: str = Field(..., alias='samplePointId')
    result_value: float = Field(..., alias='resultValue')
    recommended_action: str = Field(..., alias='recommendedAction')
    status: Literal['active', 'acknowledged', 'investigating', 'resolved', 'false-positive'] = Field(..., alias='status')

class ControlChartPoint(BaseModel):
    point_id: str = Field(..., alias='pointId')
    timestamp: datetime = Field(..., alias='timestamp')
    value: float = Field(..., alias='value')
    batch_id: Optional[str] = Field(None, alias='batchId')
    sample_id: Optional[str] = Field(None, alias='sampleId')
    signal_ids: List[str] = Field(..., alias='signalIds')
    status: Literal['in-control', 'warning', 'out-of-control'] = Field(..., alias='status')

class ControlChartSeries(BaseModel):
    chart_id: str = Field(..., alias='chartId')
    chart_type: ChartType = Field(..., alias='chartType')
    characteristic_id: str = Field(..., alias='characteristicId')
    characteristic_name: str = Field(..., alias='characteristicName')
    points: List[ControlChartPoint] = Field(..., alias='points')
    center_line: Optional[float] = Field(None, alias='centerLine')
    upper_control_limit: Optional[float] = Field(None, alias='upperControlLimit')
    lower_control_limit: Optional[float] = Field(None, alias='lowerControlLimit')
    upper_spec_limit: Optional[float] = Field(None, alias='upperSpecLimit')
    lower_spec_limit: Optional[float] = Field(None, alias='lowerSpecLimit')
    unit_of_measure: str = Field(..., alias='unitOfMeasure')
    confidence: float = Field(..., ge=0, le=1, alias='confidence')
    limit_provenance: Optional[LimitProvenance] = Field(None, alias='limitProvenance')
    approval_state: Optional[ApprovalState] = Field(None, alias='approvalState')
    locked_limits: Optional[bool] = Field(None, alias='lockedLimits')
    locked_from: Optional[datetime] = Field(None, alias='lockedFrom')
    locked_to: Optional[datetime] = Field(None, alias='lockedTo')

class CharacteristicCapability(BaseModel):
    characteristic_id: str = Field(..., alias='characteristicId')
    characteristic_name: str = Field(..., alias='characteristicName')
    cp: float = Field(..., alias='cp')
    cpk: float = Field(..., alias='cpk')
    pp: float = Field(..., alias='pp')
    ppk: float = Field(..., alias='ppk')
    sample_count: int = Field(..., alias='sampleCount', ge=0)
    mean: float = Field(..., alias='mean')
    standard_deviation: float = Field(..., alias='standardDeviation', ge=0)
    confidence: float = Field(..., ge=0, le=1, alias='confidence')
    interpretation: Literal['capable', 'marginal', 'not-capable', 'insufficient-data'] = Field(..., alias='interpretation')
    limit_provenance: Optional[LimitProvenance] = Field(None, alias='limitProvenance')
    approval_state: Optional[ApprovalState] = Field(None, alias='approvalState')

class SPCAlarmHistoryItem(BaseModel):
    alarm_id: str = Field(..., alias='alarmId')
    timestamp: datetime = Field(..., alias='timestamp')
    characteristic_id: str = Field(..., alias='characteristicId')
    rule: str = Field(..., alias='rule')
    rule_code: Optional[str] = Field(None, alias='ruleCode')
    severity: Severity = Field(..., alias='severity')
    status: Literal['active', 'acknowledged', 'investigating', 'resolved', 'false-positive'] = Field(..., alias='status')
    acknowledged_by: Optional[str] = Field(None, alias='acknowledgedBy')
    acknowledged_at: Optional[datetime] = Field(None, alias='acknowledgedAt')
    linked_batch_id: Optional[str] = Field(None, alias='linkedBatchId')

class SPCRelatedBatch(BaseModel):
    batch_id: str = Field(..., alias='batchId')
    material_id: str = Field(..., alias='materialId')
    plant_id: str = Field(..., alias='plantId')
    status: Literal['released', 'on-hold', 'rejected', 'under-review', 'awaiting-review'] = Field(..., alias='status')
    related_signal_count: int = Field(..., alias='relatedSignalCount', ge=0)
    release_impact: Literal['blocking', 'risk', 'none'] = Field(..., alias='releaseImpact')
    drill_through_target: Optional[str] = Field(None, alias='drillThroughTarget')

class SPCSubgroupPoint(BaseModel):
    batch_id: str = Field(..., alias='batchId')
    batch_date: str = Field(..., alias='batchDate')
    subgroup_mean: float = Field(..., alias='subgroupMean')
    subgroup_range: Optional[float] = Field(None, alias='subgroupRange')
    sample_count: int = Field(..., alias='sampleCount', ge=1)
    lsl_spec: Optional[float] = Field(None, alias='lslSpec')
    usl_spec: Optional[float] = Field(None, alias='uslSpec')

class SPCSubgroupResponse(BaseModel):
    material_id: str = Field(..., alias='materialId')
    plant_id: str = Field(..., alias='plantId')
    mic_id: str = Field(..., alias='micId')
    mic_name: Optional[str] = Field(None, alias='micName')
    operation_id: str = Field(..., alias='operationId')
    points: List[SPCSubgroupPoint] = Field(..., alias='points')
    locked_limits: type(None) = Field(None, alias='lockedLimits')
    capability_available: Literal[False] = Field(False, alias='capabilityAvailable')
    nelson_stored_flags_available: Literal[False] = Field(False, alias='nelsonStoredFlagsAvailable')
    signals_client_side_only: Literal[True] = Field(True, alias='signalsClientSideOnly')

class SpcChartDataRequest(BaseModel):
    material_id: str = Field(..., alias='materialId')
    plant_id: str = Field(..., alias='plantId')
    mic_id: str = Field(..., alias='micId')
    operation_id: str = Field(..., alias='operationId')
    chart_type: Optional[ChartType] = Field(None, alias='chartType')
    date_from: str = Field(..., alias='dateFrom')
    date_to: str = Field(..., alias='dateTo')
    max_rows: Optional[int] = Field(None, alias='maxRows', ge=1, le=200)

class SpcChartLimitsBlock(BaseModel):
    center_line: Optional[float] = Field(None, alias='centerLine')
    upper_control_limit: Optional[float] = Field(None, alias='upperControlLimit')
    lower_control_limit: Optional[float] = Field(None, alias='lowerControlLimit')
    upper_control_limit_range: Optional[float] = Field(None, alias='uclR')
    lower_control_limit_range: Optional[float] = Field(None, alias='lclR')
    sigma_within: Optional[float] = Field(None, alias='sigmaWithin')
    limit_provenance: LimitProvenance = Field(..., alias='limitProvenance')
    approval_state: ApprovalState = Field(..., alias='approvalState')
    locked_limits: bool = Field(..., alias='lockedLimits')
    locked_from: Optional[str] = Field(None, alias='lockedFrom')
    locked_to: Optional[str] = Field(None, alias='lockedTo')
    locked_by: Optional[str] = Field(None, alias='lockedBy')
    locked_at: Optional[str] = Field(None, alias='lockedAt')
    locking_note: Optional[str] = Field(None, alias='lockingNote')

class SpcSpecLimitsBlock(BaseModel):
    upper_spec_limit: Optional[float] = Field(None, alias='upperSpecLimit')
    lower_spec_limit: Optional[float] = Field(None, alias='lowerSpecLimit')
    nominal_target: Optional[float] = Field(None, alias='nominalTarget')
    tolerance_half_width: Optional[float] = Field(None, alias='toleranceHalfWidth')
    raw_tolerance: Optional[float] = Field(None, alias='rawTolerance')
    spec_signature: Optional[str] = Field(None, alias='specSignature')
    spec_type: Optional[str] = Field(None, alias='specType')
    source_status: Literal['present', 'not-populated-zero-zero', 'lower-only', 'upper-only', 'unavailable'] = Field(..., alias='sourceStatus')

class SpcChartPoint(BaseModel):
    point_id: str = Field(..., alias='pointId')
    batch_id: str = Field(..., alias='batchId')
    batch_date: str = Field(..., alias='batchDate')
    first_posting_date: Optional[str] = Field(None, alias='firstPostingDate')
    last_posting_date: Optional[str] = Field(None, alias='lastPostingDate')
    subgroup_mean: Optional[float] = Field(None, alias='subgroupMean')
    subgroup_range: float = Field(..., alias='subgroupRange')
    subgroup_std_dev: Optional[float] = Field(None, alias='subgroupStdDev')
    sample_count: int = Field(..., alias='sampleCount', ge=0)
    source_row_count: int = Field(..., alias='sourceRowCount', ge=0)
    min_value: float = Field(..., alias='minValue')
    max_value: float = Field(..., alias='maxValue')
    individual_values: List[float] = Field(..., alias='individualValues')
    any_rejection: bool = Field(..., alias='anyRejection')
    any_acceptance: bool = Field(..., alias='anyAcceptance')
    warnings: List[str] = Field(default_factory=list, alias='warnings')

class SpcChartDataResponse(BaseModel):
    chart_series: List[SpcChartPoint] = Field(..., alias='chartSeries')
    control_limits: SpcChartLimitsBlock = Field(..., alias='controlLimits')
    spec_limits: SpcSpecLimitsBlock = Field(..., alias='specLimits')
    signals_source: Literal['calculated-frontend', 'calculated-backend', 'not-yet-evaluated', 'unavailable'] = Field(..., alias='signalsSource')
    capability_source: Literal['present-from-mv', 'backend-calculation-required', 'legacy-bridge', 'unavailable'] = Field(..., alias='capabilitySource')
    excluded_row_count: int = Field(..., alias='excludedRowCount', ge=0)
    excluded_reasons: List[Literal['sentinel-plant-p999', 'blank-material-id']] = Field(default_factory=list, alias='excludedReasons')
    warnings: List[str] = Field(default_factory=list, alias='warnings')
    queried_at: str = Field(..., alias='queriedAt')
    source_data_as_of: Optional[str] = Field(None, alias='sourceDataAsOf')
