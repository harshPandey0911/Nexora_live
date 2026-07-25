# Workspace Rules for Nexora

## Standard Pagination Pattern
Whenever adding or updating pagination across any module (Admin, Vendor, Worker, User):
- Always use the reusable `Pagination` component located at `Frontend/src/components/common/Pagination.jsx`.
- **Component Features**:
  - Direct clickable page numbers `[1] [2] [3] ... [N]` with current page highlight.
  - First page (`«`) and Last page (`»`) quick jumps.
  - Range counter display: `Showing X–Y of Z results`.
  - Items per page selector: `Rows: 5 | 10 | 20 | 50`.
- **Import Pattern**:
  `import Pagination from 'src/components/common/Pagination';` or `import { Pagination } from 'src/components/common';`
