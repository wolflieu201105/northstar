export interface TimelineCursor {
  createdAt: string
  id: string
}

export interface TimelinePage<Row> {
  items: Row[]
  nextCursor: TimelineCursor | null
}

export interface TimelineListState<Row> {
  items: Row[]
  nextCursor: TimelineCursor | null
  isLoading: boolean
  error: string | null
}

export interface PaginatedTimelineState<Row> extends TimelineListState<Row> {
  isLoadingMore: boolean
  failedLoadMore: boolean
}
