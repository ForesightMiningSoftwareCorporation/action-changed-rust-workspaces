# Generate Github Actions Matrix For Rust Workspaces

```yml
jobs:
  build-matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.build.outputs.matrix }}
      fallback-matrix: ${{ steps.build.outputs.fallback }}
    steps:
      - name: Generate Matrix
        id: build
        uses: ForesightMiningSoftwareCorporation/action-changed-rust-workspaces@v0
        with:
          token: ${{ github.token }}
          workspaces: '["."]'
          base_ref: ${{ github.base_ref }}
          head_ref: ${{ github.head_ref }}

  example:
    needs: build-matrix
    strategy:
      matrix:
        path: ${{ fromJson(needs.build-matrix.outputs.matrix) }}
```
