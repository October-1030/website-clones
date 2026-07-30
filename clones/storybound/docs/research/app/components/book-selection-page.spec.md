# BookSelectionPage Specification

## Overview

- Target: `desktop-app/src/components/BookSelectionPage.tsx`
- Evidence: v1.16.1 `BookSelectionPage-DkTPCpth.js`
- Interaction model: local book-list CRUD + filters + task handoff

## Required behavior

- Header: `选品助手`.
- Built-in topic presets: health/TCM, longevity, culture/classics,
  biography/women, biography/emperor, business figures, cognition/growth,
  parenting and wealth/finance.
- Category filters cover literature, parenting, health, success,
  finance, economics, philosophy, psychology, classics, culture,
  history, biography, science and medicine.
- Users can create/delete/rename lists and add/edit/remove books.
- Book fields: title, author, category, price, sales/rank, rating,
  selling points, cover URL/local image, source URL and notes.
- Search, category, rank and rating filters.
- Import/export JSON and CSV.
- `用此书商品信息创建带货任务` hands title/author/selling points to the create page.
- `去对标监控搜索` opens Benchmark with the book title as a query.
- All user data persists locally; the page must not invent live sales data.

## Visual contract

- Filter rail, toolbar and dense table/card switch.
- Top-three rank uses danger color; incomplete fields use warning color.
- Responsive layout becomes cards below 760 px.

