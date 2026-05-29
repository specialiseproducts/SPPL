/** Standard paginated API envelope from backend list endpoints. */
export type PaginatedResponse<T> = {
  data: T[];
  nextCursor: string | null;
};

export const DEFAULT_PAGE_SIZE = 50;
