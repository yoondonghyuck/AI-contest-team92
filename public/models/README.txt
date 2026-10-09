# Place a trained KES surrogate here as fiber_kes.onnx
# Expected input: float32 [1, 5] = denier, crystallinity, length_mm, crimp_cpi, shape_id
# Expected output: float32 [1, 6] = B, G, EMT, W, 2H0, DC
