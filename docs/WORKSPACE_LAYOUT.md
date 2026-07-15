# Workspace Layout

This repository is both the reusable website-cloning template and a workspace for completed clones.

## Root

The root keeps only template-level files:

- agent instructions and clone-website skills
- the clean Next.js scaffold
- shared sync scripts
- template documentation and design references

## `clones/`

Every target site gets a separate, self-contained project at `clones/<site-slug>/`. Site-specific code, assets, screenshots, research, and scripts belong there.

The current project is `clones/asksia/`.

## Adding another clone

Create a new folder using a short stable slug, copy the clean scaffold into it, and keep all generated artifacts inside that folder. Existing clone folders should not be reused for a different target.
