export const employeesQueryKeys = {
  all: ['employees'] as const,
  list: () => [...employeesQueryKeys.all, 'list'] as const,
};
