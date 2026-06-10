"""Pydantic schemas for all GTM modules."""

from pydantic import BaseModel, Field


# --- CompetitiveLandscape (Layer 1) ---

class Competitor(BaseModel):
    id: str = Field(description="e.g. ec-001")
    name: str
    rationale: str = Field(description="Why this title is in the competitive set")


class CompetitiveLandscape(BaseModel):
    summary: str
    existingCompetitors: list[Competitor]


# --- AudienceOverview (Layer 2) ---

class AudienceSegment(BaseModel):
    id: str = Field(description="e.g. seg-1")
    segmentName: str
    description: str = Field(description="Behaviors, motivations, and boundaries")
    selectedExistingCompetitors: list[str] = Field(
        description="Names from CompetitiveLandscape.existingCompetitors"
    )


class AudienceOverview(BaseModel):
    summary: str = Field(description="Segmentation logic grounded in the competitive landscape")
    segments: list[AudienceSegment]


# --- PositioningMatrix (Layer 3) ---

class Axis(BaseModel):
    axisName: str
    lowLabel: str
    highLabel: str


class Position(BaseModel):
    id: str = Field(description="e.g. pm-001")
    gameName: str
    xPosition: float = Field(ge=0, le=10)
    yPosition: float = Field(ge=0, le=10)


class PositioningMatrix(BaseModel):
    xAxis: Axis
    yAxis: Axis
    positions: list[Position]


# --- SWOT (Layer 3) ---

class SWOTItem(BaseModel):
    id: str
    text: str


class SWOT(BaseModel):
    strengths: list[SWOTItem]
    weaknesses: list[SWOTItem]
    opportunities: list[SWOTItem]
    threats: list[SWOTItem]


# --- Pipeline State ---

class PipelineState(BaseModel):
    competitiveLandscape: CompetitiveLandscape | None = None
    audienceOverview: AudienceOverview | None = None
    positioningMatrix: PositioningMatrix | None = None
    swot: SWOT | None = None
