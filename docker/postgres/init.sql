-- =============================================================================
-- PolyMatrix Engine: PostgreSQL 16 + pgvector Unified Polymer Asset & RAG Schema
-- =============================================================================
-- Executes automatically on first container start via /docker-entrypoint-initdb.d/

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Source Type Enumeration Concept (Enforced via CHECK constraint for flexibility)
--    - OPEN_BENCHMARK    : 3,284 PI1M/Polymer Genome open dataset + 30 commercial baselines
--    - ACTIVE_S_TIER     : 5,000 real-time S-tier sliding window candidates
--    - ARCHIVED_REJECTED : Sliding-window evicted S-tier records + QC-rejected candidates

CREATE TABLE IF NOT EXISTS polymer_materials (
    id VARCHAR(80) PRIMARY KEY,
    source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('OPEN_BENCHMARK', 'ACTIVE_S_TIER', 'ARCHIVED_REJECTED')),
    name VARCHAR(512) NOT NULL,
    korean_name VARCHAR(512) NOT NULL,
    short_code VARCHAR(160),
    category VARCHAR(160) NOT NULL,
    architecture VARCHAR(120),
    morphology VARCHAR(120),
    smiles VARCHAR(1024),
    quality_grade VARCHAR(32),
    innovation_score DOUBLE PRECISION DEFAULT 0,
    tg DOUBLE PRECISION DEFAULT 0,
    tm DOUBLE PRECISION,
    td DOUBLE PRECISION,
    tensile_strength DOUBLE PRECISION DEFAULT 0,
    modulus_gpa DOUBLE PRECISION DEFAULT 0,
    elongation DOUBLE PRECISION DEFAULT 0,
    density DOUBLE PRECISION DEFAULT 1.15,
    crystallinity DOUBLE PRECISION DEFAULT 25.0,
    dp_n INTEGER DEFAULT 100,
    mn DOUBLE PRECISION DEFAULT 25000,
    pdi DOUBLE PRECISION DEFAULT 1.8,
    chi_n DOUBLE PRECISION DEFAULT 0,
    hsp_total DOUBLE PRECISION DEFAULT 20.0,
    tanimoto_max DOUBLE PRECISION DEFAULT 0,
    status_stage VARCHAR(120) NOT NULL DEFAULT 'PASSED',
    status_reason TEXT NOT NULL DEFAULT 'Verified Polymer Asset',
    file_path VARCHAR(512) NOT NULL,
    embedding vector(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Fast Filtering & Metadata Listing Indexes
CREATE INDEX IF NOT EXISTS idx_polymer_materials_source_type
    ON polymer_materials (source_type);

CREATE INDEX IF NOT EXISTS idx_polymer_materials_grade_score
    ON polymer_materials (source_type, quality_grade, innovation_score DESC);

CREATE INDEX IF NOT EXISTS idx_polymer_materials_thermal_mech
    ON polymer_materials (tg, tensile_strength, td);

CREATE INDEX IF NOT EXISTS idx_polymer_materials_created_at
    ON polymer_materials (created_at DESC);

-- 3. HNSW Vector Index for Sub-Millisecond Multi-Source Cosine/L2 RAG Retrieval
CREATE INDEX IF NOT EXISTS idx_polymer_materials_embedding_hnsw
    ON polymer_materials
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 4. Daemon & RAG Telemetry Table
CREATE TABLE IF NOT EXISTS polymer_engine_telemetry (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'main',
    engine_status VARCHAR(64) NOT NULL DEFAULT 'RUNNING',
    open_benchmark_count INTEGER NOT NULL DEFAULT 0,
    active_s_tier_count INTEGER NOT NULL DEFAULT 0,
    archived_rejected_count INTEGER NOT NULL DEFAULT 0,
    total_candidates_generated INTEGER NOT NULL DEFAULT 0,
    rejected_stage1_octet_valency INTEGER NOT NULL DEFAULT 0,
    rejected_stage1_dp_cutoff INTEGER NOT NULL DEFAULT 0,
    rejected_stage1_thermodynamic_instability INTEGER NOT NULL DEFAULT 0,
    rejected_stage2_tanimoto_similarity INTEGER NOT NULL DEFAULT 0,
    rejected_stage2_cosmetic_low_delta INTEGER NOT NULL DEFAULT 0,
    rejected_stage3_sub_s_grade INTEGER NOT NULL DEFAULT 0,
    sliding_window_evictions INTEGER NOT NULL DEFAULT 0,
    daemon_interval_ms INTEGER NOT NULL DEFAULT 15000,
    daemon_batch_size INTEGER NOT NULL DEFAULT 2,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

