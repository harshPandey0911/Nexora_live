---
name: standard-pagination
description: Standard pagination implementation pattern using Frontend/src/components/common/Pagination.jsx
---

# Standard Pagination Skill

Use `Frontend/src/components/common/Pagination.jsx` for all paginated tables, card lists, ledgers, and feeds.

## Usage Snippet
```jsx
import { Pagination } from 'src/components/common';

<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={totalItems}
  pageSize={pageSize}
  onPageChange={(page) => setCurrentPage(page)}
  onPageSizeChange={(newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }}
  pageSizeOptions={[5, 10, 20, 50]}
/>
```
