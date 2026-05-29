/** Single shared employees cache — used by User Management, Expenses, Sales, Access Control. */
export const employeesQueryKeys = {
  all: ['employees'] as const,
  infinite: () => [...employeesQueryKeys.all, 'infinite'] as const,
};
