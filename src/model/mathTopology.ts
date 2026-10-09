/**
 * 분자 그래프 이론 및 위상수학(Chemical Graph Theory & Topology) 연산 모듈
 * 인접 행렬, 라플라시안 행렬, 고유치 스펙트럼(Jacobi Solver), 토폴로지 지수 계산
 */

export interface MolecularGraph {
  nodes: { id: string; label: string; element: string; x?: number; y?: number }[];
  edges: { source: string; target: string; order: number }[];
}

export interface GraphTopologyResult {
  nodeCount: number;
  edgeCount: number;
  degreeDistribution: { degree: number; count: number }[];
  avgDegree: number;
  maxDegree: number;
  adjacencyMatrix: number[][];
  laplacianMatrix: number[][];
  normalizedLaplacianMatrix: number[][];
  eigenvalues: number[]; // 오름차순 정렬된 라플라시안 고유값
  fiedlerValue: number; // λ2 (대수적 연결도)
  spectralGap: number; // λ2 - λ1
  fiedlerVector: number[]; // λ2에 해당하는 고유벡터
  adjacencyEigenvalues: number[]; // 인접 행렬 고유값 (HOMO-LUMO 대리 특성)
  wienerIndex: number; // 위너 지수 W
  randicIndex: number; // 랜딕 지수 χ
  zagrebIndexM1: number; // 자그레브 M1
  zagrebIndexM2: number; // 자그레브 M2
  balabanIndex: number; // 발라반 J 지수
  diameter: number; // 그래프 지름
  avgPathLength: number; // 평균 최단 경로 길이
  distanceMatrix: number[][];
  isConnected: boolean;
}

/**
 * 실대칭 행렬의 고유값 및 고유벡터를 구하는 Jacobi Eigenvalue Solver
 */
export function jacobiEigenSolver(matrix: number[][], maxIter = 100, eps = 1e-7): {
  eigenvalues: number[];
  eigenvectors: number[][];
} {
  const n = matrix.length;
  if (n === 0) return { eigenvalues: [], eigenvectors: [] };

  // 복사본 생성
  const A: number[][] = matrix.map((row) => [...row]);
  // 고유벡터 초기화 (단위 행렬)
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  for (let iter = 0; iter < maxIter; iter++) {
    // 최대 비대각 원소 찾기
    let maxVal = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > maxVal) {
          maxVal = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }

    if (maxVal < eps) break;

    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];

    const theta = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    // Givens 회전 적용
    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = A[i][p];
        const aiq = A[i][q];
        A[i][p] = c * aip - s * aiq;
        A[p][i] = A[i][p];
        A[i][q] = s * aip + c * aiq;
        A[q][i] = A[i][q];
      }
    }

    A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    A[p][q] = 0;
    A[q][p] = 0;

    // 고유벡터 누적
    for (let i = 0; i < n; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = c * vip - s * viq;
      V[i][q] = s * vip + c * viq;
    }
  }

  const eigenvalues = A.map((row, i) => row[i]);
  return { eigenvalues, eigenvectors: V };
}

/**
 * Floyd-Warshall 알고리즘 기반 전역 최단 경로 거리 행렬 계산
 */
export function computeDistanceMatrix(adjMatrix: number[][]): number[][] {
  const n = adjMatrix.length;
  const dist: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 0;
      if (adjMatrix[i][j] > 0) return 1;
      return Infinity;
    })
  );

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (dist[i][k] + dist[k][j] < dist[i][j]) {
          dist[i][j] = dist[i][k] + dist[k][j];
        }
      }
    }
  }

  return dist;
}

/**
 * 분자 그래프를 입력받아 완벽한 수학적 그래프 이론 및 토폴로지 분석 수행
 */
export function analyzeMolecularTopology(graph: MolecularGraph): GraphTopologyResult {
  const { nodes, edges } = graph;
  const n = nodes.length;

  if (n === 0) {
    return {
      nodeCount: 0,
      edgeCount: 0,
      degreeDistribution: [],
      avgDegree: 0,
      maxDegree: 0,
      adjacencyMatrix: [],
      laplacianMatrix: [],
      normalizedLaplacianMatrix: [],
      eigenvalues: [],
      fiedlerValue: 0,
      spectralGap: 0,
      fiedlerVector: [],
      adjacencyEigenvalues: [],
      wienerIndex: 0,
      randicIndex: 0,
      zagrebIndexM1: 0,
      zagrebIndexM2: 0,
      balabanIndex: 0,
      diameter: 0,
      avgPathLength: 0,
      distanceMatrix: [],
      isConnected: false,
    };
  }

  const idToIndex = new Map<string, number>();
  nodes.forEach((node, idx) => idToIndex.set(node.id, idx));

  // 1. 인접 행렬 생성
  const A: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  edges.forEach((edge) => {
    const u = idToIndex.get(edge.source);
    const v = idToIndex.get(edge.target);
    if (u !== undefined && v !== undefined && u !== v) {
      A[u][v] = 1;
      A[v][u] = 1;
    }
  });

  // 2. 차수 계산 & 차수 행렬 D
  const degrees = A.map((row) => row.reduce((sum, val) => sum + val, 0));
  const avgDegree = Number((degrees.reduce((sum, d) => sum + d, 0) / n).toFixed(2));
  const maxDegree = Math.max(...degrees, 0);

  // 차수 분포
  const degCountMap = new Map<number, number>();
  degrees.forEach((d) => degCountMap.set(d, (degCountMap.get(d) || 0) + 1));
  const degreeDistribution = Array.from(degCountMap.entries())
    .map(([degree, count]) => ({ degree, count }))
    .sort((a, b) => a.degree - b.degree);

  // 3. 라플라시안 행렬 L = D - A
  const L: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return degrees[i];
      return -A[i][j];
    })
  );

  // 4. 대칭 정규화 라플라시안 L_sym = D^{-1/2} L D^{-1/2}
  const Lsym: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const di = degrees[i];
      const dj = degrees[j];
      if (di === 0 || dj === 0) return i === j ? 1 : 0;
      if (i === j) return 1;
      return -A[i][j] / Math.sqrt(di * dj);
    })
  );

  // 5. 고유치 스펙트럼 계산
  const laplacianEig = jacobiEigenSolver(L);
  // 고유값 오름차순 정렬
  const eigPairs = laplacianEig.eigenvalues.map((val, idx) => ({
    val: Math.abs(val) < 1e-6 ? 0 : val,
    vector: laplacianEig.eigenvectors.map((row) => row[idx]),
  }));
  eigPairs.sort((a, b) => a.val - b.val);

  const eigenvalues = eigPairs.map((p) => Number(p.val.toFixed(4)));
  const fiedlerValue = eigPairs.length > 1 ? Number(eigPairs[1].val.toFixed(4)) : 0;
  const fiedlerVector = eigPairs.length > 1 ? eigPairs[1].vector : Array(n).fill(0);
  const spectralGap = eigPairs.length > 1 ? Number((eigPairs[1].val - eigPairs[0].val).toFixed(4)) : 0;

  // 인접 행렬의 고유값
  const adjEig = jacobiEigenSolver(A);
  const adjacencyEigenvalues = adjEig.eigenvalues
    .map((v) => Number((Math.abs(v) < 1e-6 ? 0 : v).toFixed(4)))
    .sort((a, b) => b - a);

  // 6. 거리 행렬 및 최단 경로 지표
  const distanceMatrix = computeDistanceMatrix(A);
  let diameter = 0;
  let totalPathDist = 0;
  let reachablePairs = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = distanceMatrix[i][j];
      if (d !== Infinity) {
        if (d > diameter) diameter = d;
        totalPathDist += d;
        reachablePairs++;
      }
    }
  }

  const isConnected = reachablePairs === (n * (n - 1)) / 2 && n > 1;
  const avgPathLength =
    reachablePairs > 0 ? Number((totalPathDist / reachablePairs).toFixed(2)) : 0;

  // 7. 화학 그래프 토폴로지 지수 계산
  // Wiener Index W = sum_{i < j} d(i, j)
  let wienerIndex = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (distanceMatrix[i][j] !== Infinity) {
        wienerIndex += distanceMatrix[i][j];
      }
    }
  }

  // Randic Connectivity Index chi = sum_{(u,v) in E} 1 / sqrt(deg(u)*deg(v))
  let randicIndex = 0;
  let zagrebIndexM2 = 0;
  edges.forEach((edge) => {
    const u = idToIndex.get(edge.source);
    const v = idToIndex.get(edge.target);
    if (u !== undefined && v !== undefined && u !== v) {
      const du = degrees[u];
      const dv = degrees[v];
      if (du > 0 && dv > 0) {
        randicIndex += 1 / Math.sqrt(du * dv);
        zagrebIndexM2 += du * dv;
      }
    }
  });
  randicIndex = Number(randicIndex.toFixed(3));

  // Zagreb M1 = sum deg(u)^2
  const zagrebIndexM1 = degrees.reduce((sum, d) => sum + d * d, 0);

  // Balaban J Index: J = (M / (mu + 1)) * sum_{(u,v)} (D_u * D_v)^(-1/2)
  // where M = edgeCount, mu = cyclomatic number = M - N + 1
  const M = edges.length;
  const mu = Math.max(0, M - n + 1);
  const distanceSums = distanceMatrix.map((row) =>
    row.reduce((acc, d) => (d !== Infinity ? acc + d : acc), 0)
  );

  let balabanSum = 0;
  edges.forEach((edge) => {
    const u = idToIndex.get(edge.source);
    const v = idToIndex.get(edge.target);
    if (u !== undefined && v !== undefined && u !== v) {
      const Du = distanceSums[u];
      const Dv = distanceSums[v];
      if (Du > 0 && Dv > 0) {
        balabanSum += 1 / Math.sqrt(Du * Dv);
      }
    }
  });

  const balabanIndex =
    M > 0 && mu + 1 > 0 ? Number(((M / (mu + 1)) * balabanSum).toFixed(3)) : 0;

  return {
    nodeCount: n,
    edgeCount: edges.length,
    degreeDistribution,
    avgDegree,
    maxDegree,
    adjacencyMatrix: A,
    laplacianMatrix: L,
    normalizedLaplacianMatrix: Lsym,
    eigenvalues,
    fiedlerValue,
    spectralGap,
    fiedlerVector,
    adjacencyEigenvalues,
    wienerIndex,
    randicIndex,
    zagrebIndexM1,
    zagrebIndexM2,
    balabanIndex,
    diameter,
    avgPathLength,
    distanceMatrix,
    isConnected,
  };
}
