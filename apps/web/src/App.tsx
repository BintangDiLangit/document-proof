import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  useConnect,
  useConnection,
  useDisconnect,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import { formatEther, type WalletClient } from "viem";
import QRCode from "qrcode";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Fingerprint,
  Github,
  History,
  Info,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import {
  hashPdf,
  isAddress,
  isHash,
  parseProof,
  parseProofRoute,
  proofLink,
  requireDeployment,
  type Address,
  type Deployment,
  type Hex,
  type Proof,
} from "./proof";
import {
  humanError,
  loadDeployment,
  localDevWallet,
  lookup,
  publicClient,
  recentDocuments,
  sendWrite,
  simulateWrite,
  type LookupResult,
} from "./chain";
import { registryAbi } from "./generated/registry";

type Page = "verify" | "issue" | "activity" | "guide" | "issuer" | "admin";
type Demo = { issuer: Address; sha256Hash: Hex; ids: Record<string, Hex> };
type Pending = {
  kind: "issue" | "revoke" | "permission";
  hash: Hex;
  proof?: Proof;
};
const zeroHash = ("0x" + "0".repeat(64)) as Hex;
const short = (text: string) => `${text.slice(0, 6)}…${text.slice(-4)}`;
const date = (value: bigint) =>
  value === 0n
    ? "No expiry"
    : value > 8640000000000n
      ? "Outside supported date range"
      : new Date(Number(value) * 1000).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
const explorer = (d: Deployment, path: string) =>
  d.chainId === 84532 ? `https://sepolia.basescan.org/${path}` : null;
function download(
  name: string,
  data: Blob | string,
  type = "application/json",
) {
  const url = URL.createObjectURL(
    data instanceof Blob ? data : new Blob([data], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function IconButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}
function DataRow({
  label,
  value,
  copy = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
}) {
  return (
    <div className="data-row">
      <span>{label}</span>
      <div className={copy ? "mono" : ""}>
        {value}
        {copy && (
          <IconButton value={value} label={`Copy ${label.toLowerCase()}`} />
        )}
      </div>
    </div>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("verify");
  const [menu, setMenu] = useState(false);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [demo, setDemo] = useState<Demo | null>(null);
  const [target, setTarget] = useState<{
    issuer: Address;
    documentId: Hex;
  } | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [fileHash, setFileHash] = useState<Hex | null>(null);
  const [fileName, setFileName] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [linkText, setLinkText] = useState("");
  const [revision, setRevision] = useState(0);
  const fileGeneration = useRef(0);
  const issueGeneration = useRef(0);
  const receiptInput = useRef<HTMLInputElement>(null);
  const [devWallet, setDevWallet] = useState<WalletClient | null>(null);
  const { address, chainId } = useConnection();
  const { data: connectedWallet } = useWalletClient();
  const {
    mutateAsync: connect,
    connectors,
    isPending: connecting,
  } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { mutateAsync: switchChain } = useSwitchChain();
  const wallet = devWallet ?? connectedWallet;
  const walletAddress = wallet?.account?.address ?? address;
  const [allowed, setAllowed] = useState(false);
  const [owner, setOwner] = useState<Address | null>(null);
  const [issueHash, setIssueHash] = useState<Hex | null>(null);
  const [issueFile, setIssueFile] = useState("");
  const [issueId, setIssueId] = useState<Hex | null>(null);
  const [expiry, setExpiry] = useState("");
  const [estimate, setEstimate] = useState<bigint | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [txMessage, setTxMessage] = useState("");
  const [issued, setIssued] = useState<Proof | null>(null);
  const [qr, setQr] = useState("");
  const [history, setHistory] = useState<Proof[]>([]);
  const [historyNext, setHistoryNext] = useState<bigint | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [adminAddress, setAdminAddress] = useState("");
  const [adminEnabled, setAdminEnabled] = useState(true);
  const [revokeReview, setRevokeReview] = useState(false);
  const operation = useRef(false);
  const pendingKey = deployment
    ? `document-proof:pending:${deployment.chainId}:${deployment.registry.toLowerCase()}`
    : null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadDeployment(),
      fetch(`${import.meta.env.BASE_URL}samples/demo.json`).then((r) =>
        r.json(),
      ),
    ])
      .then(([d, s]) => {
        if (cancelled) return;
        setDeployment(d);
        setDemo(s);
        setTarget({ issuer: d?.issuer ?? s.issuer, documentId: s.ids.active });
        setLoaded(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(humanError(e));
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const route = () => {
      const p = parseProofRoute(location.hash);
      fileGeneration.current++;
      setFileHash(null);
      setFileName("");
      setError("");
      setRevokeReview(false);
      if (p) {
        setPage("verify");
        if (
          !deployment ||
          p.chainId !== deployment.chainId ||
          p.registry.toLowerCase() !== deployment.registry.toLowerCase()
        ) {
          setTarget(null);
          setResult(null);
          setError("This link uses an unsupported network or registry.");
        } else setTarget({ issuer: p.issuer, documentId: p.documentId });
      } else if (location.hash.startsWith("#/verify/")) {
        setPage("verify");
        setTarget(null);
        setResult(null);
        setError(
          "This verification link is incomplete. Choose a receipt or one of the sample documents.",
        );
      } else {
        const p = location.hash.replace("#/", "");
        setPage(
          ["issue", "activity", "guide", "issuer", "admin"].includes(p)
            ? (p as Page)
            : "verify",
        );
      }
    };
    if (loaded) route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, [loaded, deployment]);

  useEffect(() => {
    let cancelled = false;
    if (!target || !loaded) {
      setChecking(false);
      return;
    }
    setChecking(true);
    setResult(null);
    setError("");
    const work = deployment
      ? lookup(deployment, target.issuer, target.documentId, fileHash)
      : Promise.resolve<LookupResult>({
          record: {
            sha256Hash: demo?.sha256Hash ?? zeroHash,
            issuedAt: 1767225600n,
            expiresAt:
              target.documentId === demo?.ids.expired ? 1769904000n : 0n,
            revoked: target.documentId === demo?.ids.revoked,
          },
          recordStatus:
            target.documentId === demo?.ids.revoked
              ? "revoked"
              : target.documentId === demo?.ids.expired
                ? "expired"
                : "active",
          integrity: !fileHash
            ? "unchecked"
            : fileHash === demo?.sha256Hash
              ? "match"
              : "mismatch",
          issuerEnabled: true,
          block: "simulated",
          proof: null,
        });
    work
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled)
          setError(`Status could not be verified. ${humanError(e)}`);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deployment, target, fileHash, loaded, demo, revision]);

  useEffect(() => {
    let cancelled = false;
    setAllowed(false);
    setOwner(null);
    if (!deployment) return;
    const c = publicClient(deployment);
    Promise.all([
      c.readContract({
        address: deployment.registry,
        abi: registryAbi,
        functionName: "owner",
      }),
      walletAddress
        ? c.readContract({
            address: deployment.registry,
            abi: registryAbi,
            functionName: "issuerEnabled",
            args: [walletAddress],
          })
        : Promise.resolve(false),
    ])
      .then(([o, a]) => {
        if (!cancelled) {
          setOwner(o);
          setAllowed(a);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [deployment, walletAddress, revision]);

  const navigate = (p: Page) => {
    location.hash = `/${p}`;
    setPage(p);
    setMenu(false);
    setError("");
  };
  const chooseTarget = (issuer: Address, documentId: Hex) => {
    fileGeneration.current++;
    setFileHash(null);
    setFileName("");
    setError("");
    setRevokeReview(false);
    setTarget({ issuer, documentId });
    setPage("verify");
  };
  const checkBytes = async (
    bytes: Uint8Array,
    name: string,
    generation: number,
  ) => {
    if (generation !== fileGeneration.current) return;
    setChecking(true);
    setError("");
    try {
      const h = await hashPdf(bytes);
      if (generation === fileGeneration.current) {
        setFileHash(h);
        setFileName(name);
      }
    } catch (e) {
      if (generation === fileGeneration.current) {
        setFileHash(null);
        setFileName("");
        setError(humanError(e));
      }
    } finally {
      if (generation === fileGeneration.current) setChecking(false);
    }
  };
  const selectPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const generation = ++fileGeneration.current;
    setFileHash(null);
    setFileName("");
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Choose a PDF smaller than 20 MB.");
      await checkBytes(
        new Uint8Array(await file.arrayBuffer()),
        file.name,
        generation,
      );
    } catch (e) {
      if (generation === fileGeneration.current) setError(humanError(e));
    }
  };
  const sample = async (
    name: "original" | "altered" | "revoked" | "expired",
  ) => {
    if (!demo) return;
    const id =
      name === "revoked"
        ? demo.ids.revoked
        : name === "expired"
          ? demo.ids.expired
          : demo.ids.active;
    chooseTarget(deployment?.issuer ?? demo.issuer, id);
    const generation = fileGeneration.current;
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}samples/${name === "altered" ? "altered" : "original"}.pdf`,
      );
      if (!response.ok) throw new Error("Sample file is unavailable.");
      await checkBytes(
        new Uint8Array(await response.arrayBuffer()),
        `${name === "altered" ? "altered" : "original"}.pdf`,
        generation,
      );
    } catch (e) {
      if (generation === fileGeneration.current) setError(humanError(e));
    }
  };
  const importReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (!deployment)
        throw new Error(
          "A published deployment is required to check a real receipt. The current session is a guided demo.",
        );
      if (file.size > 16384) throw new Error("Receipt exceeds 16 KB.");
      const proof = parseProof(JSON.parse(await file.text()));
      requireDeployment(proof, deployment);
      chooseTarget(proof.issuer, proof.documentId);
    } catch (e) {
      setError(humanError(e));
    }
  };
  const openLink = () => {
    try {
      const hash = new URL(linkText, location.href).hash;
      const p = parseProofRoute(hash);
      if (!p)
        throw new Error("Paste a complete Document Proof verification link.");
      if (
        !deployment ||
        p.chainId !== deployment.chainId ||
        p.registry.toLowerCase() !== deployment.registry.toLowerCase()
      )
        throw new Error("This link belongs to an unsupported deployment.");
      location.hash = hash;
      chooseTarget(p.issuer, p.documentId);
    } catch (e) {
      setError(humanError(e));
    }
  };

  const savePending = useCallback(
    (p: Pending | null) => {
      setPending(p);
      if (!pendingKey) return;
      try {
        if (p) localStorage.setItem(pendingKey, JSON.stringify(p));
        else localStorage.removeItem(pendingKey);
      } catch {
        setTxMessage(
          "Transaction sent. Keep its hash: browser storage is unavailable.",
        );
      }
    },
    [pendingKey],
  );
  const watchTransaction = useCallback(
    async (p: Pending) => {
      if (!deployment || operation.current) return;
      operation.current = true;
      setBusy(true);
      setTxMessage("Transaction submitted. Checking its receipt…");
      let cancelled = false;
      let latest = p;
      try {
        const receipt = await publicClient(
          deployment,
        ).waitForTransactionReceipt({
          hash: p.hash,
          confirmations: 1,
          timeout: 60000,
          onReplaced: (replacement) => {
            cancelled = replacement.reason === "cancelled";
            latest = {
              ...latest,
              hash: replacement.transaction.hash,
              proof: latest.proof
                ? {
                    ...latest.proof,
                    transactionHash: replacement.transaction.hash,
                  }
                : undefined,
            };
            savePending(latest);
          },
        });
        if (cancelled || receipt.status !== "success") {
          savePending(null);
          setTxMessage(
            cancelled
              ? "Transaction was cancelled in the wallet."
              : "Transaction reverted. No record was changed.",
          );
          return;
        }
        if (latest.kind === "issue" && latest.proof) {
          const record = await lookup(
            deployment,
            latest.proof.issuer,
            latest.proof.documentId,
            latest.proof.sha256Hash,
          );
          if (record.integrity !== "match") {
            savePending(null);
            setTxMessage(
              "Transaction included, but the expected document was not registered. Inspect wallet activity before retrying.",
            );
            return;
          }
        }
        savePending(null);
        setTxMessage(
          "Transaction included in a block. Refreshing the on-chain record.",
        );
        setRevision((v) => v + 1);
        if (latest.kind === "issue" && latest.proof) {
          setIssued({ ...latest.proof, transactionHash: latest.hash });
          setIssueHash(null);
          setIssueFile("");
          setIssueId(null);
          setEstimate(null);
        }
        setRevokeReview(false);
      } catch {
        setTxMessage(
          "The transaction is still unconfirmed here. Check its receipt or wallet activity before sending again.",
        );
      } finally {
        operation.current = false;
        setBusy(false);
      }
    },
    [deployment, savePending],
  );
  useEffect(() => {
    if (!pendingKey) return;
    try {
      const raw = localStorage.getItem(pendingKey);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (
        !isHash(p.hash) ||
        !["issue", "revoke", "permission"].includes(p.kind)
      )
        throw new Error("Invalid pending transaction");
      if (p.proof) {
        p.proof = parseProof(p.proof);
        requireDeployment(p.proof, deployment!);
      }
      setPending(p);
      setTxMessage(
        "A submitted transaction was recovered. Check its receipt before sending another.",
      );
    } catch {
      localStorage.removeItem(pendingKey);
    }
  }, [pendingKey, deployment]);
  useEffect(() => {
    let cancelled = false;
    setQr("");
    if (issued)
      QRCode.toDataURL(proofLink(issued, location.href.split("#")[0]), {
        width: 240,
        margin: 2,
        color: { dark: "#102846", light: "#ffffff" },
      }).then((value) => {
        if (!cancelled) setQr(value);
      });
    return () => {
      cancelled = true;
    };
  }, [issued]);

  const submit = async (
    kind: Pending["kind"],
    fn: "issue" | "revoke" | "setIssuer",
    args: readonly unknown[],
    proof?: Proof,
  ) => {
    if (!deployment || !wallet || pending) return;
    setError("");
    setBusy(true);
    setTxMessage("Waiting for wallet approval…");
    try {
      await simulateWrite(deployment, wallet, fn, args);
      const hash = await sendWrite(deployment, wallet, fn, args);
      const p = {
        kind,
        hash,
        proof: proof ? { ...proof, transactionHash: hash } : undefined,
      };
      savePending(p);
      setBusy(false);
      await watchTransaction(p);
    } catch (e) {
      setError(humanError(e));
      setTxMessage(
        "Submission was not confirmed. Check wallet activity before retrying.",
      );
      setBusy(false);
    }
  };
  const connectWallet = async () => {
    setError("");
    try {
      const connector = connectors[0];
      if (!connector) throw new Error("Install a browser wallet to connect.");
      await connect({ connector });
    } catch (e) {
      setError(humanError(e));
    }
  };
  const chooseIssueFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const generation = ++issueGeneration.current;
    const file = event.target.files?.[0];
    event.target.value = "";
    setEstimate(null);
    setIssued(null);
    setIssueHash(null);
    if (!file) return;
    setError("");
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Choose a PDF smaller than 20 MB.");
      const h = await hashPdf(new Uint8Array(await file.arrayBuffer()));
      if (generation !== issueGeneration.current) return;
      setIssueHash(h);
      setIssueFile(file.name);
      setIssueId(
        `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}`,
      );
    } catch (e) {
      setError(humanError(e));
    }
  };
  const expiresAt = () => {
    if (!expiry) return 0n;
    const value = Math.floor(new Date(expiry).getTime() / 1000);
    if (!Number.isFinite(value) || value <= Date.now() / 1000)
      throw new Error("Choose a future expiry date or leave it empty.");
    return BigInt(value);
  };
  const reviewIssue = async () => {
    if (!deployment || !wallet || !issueId || !issueHash) return;
    setError("");
    setReviewing(true);
    try {
      const fee = await simulateWrite(deployment, wallet, "issue", [
        issueId,
        issueHash,
        expiresAt(),
      ]);
      setEstimate(fee.maxCost);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setReviewing(false);
    }
  };
  const loadHistory = useCallback(
    async (more = false) => {
      if (!deployment || !walletAddress) return;
      setHistoryBusy(true);
      setHistoryError("");
      try {
        const r = await recentDocuments(
          deployment,
          walletAddress,
          more ? (historyNext ?? undefined) : undefined,
        );
        setHistory((old) => (more ? [...old, ...r.proofs] : r.proofs));
        setHistoryNext(r.next);
      } catch (e) {
        setHistoryError(humanError(e));
      } finally {
        setHistoryBusy(false);
      }
    },
    [deployment, walletAddress, historyNext],
  );
  useEffect(() => {
    setHistory([]);
    setHistoryNext(null);
    if (page === "activity" && deployment && walletAddress) {
      let cancelled = false;
      setHistoryBusy(true);
      recentDocuments(deployment, walletAddress)
        .then((r) => {
          if (!cancelled) {
            setHistory(r.proofs);
            setHistoryNext(r.next);
          }
        })
        .catch((e) => {
          if (!cancelled) setHistoryError(humanError(e));
        })
        .finally(() => {
          if (!cancelled) setHistoryBusy(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [page, deployment, walletAddress, revision]);

  const matched = result?.integrity === "match";
  const bad =
    result?.integrity === "mismatch" ||
    result?.recordStatus === "revoked" ||
    result?.recordStatus === "expired";
  const headline = checking
    ? "Checking the record…"
    : error && !result
      ? "Status unavailable"
      : !result
        ? "Choose a document to begin"
        : result.recordStatus === "not-found"
          ? "No record found"
          : result.recordStatus === "revoked"
            ? "This record was revoked"
            : result.recordStatus === "expired"
              ? "This record has expired"
              : result.integrity === "mismatch"
                ? "This file does not match"
                : matched
                  ? "This document matches"
                  : "Record found. Check the file.";
  const resultTone = bad
    ? "negative"
    : matched && result?.issuerEnabled
      ? "positive"
      : "neutral";
  const verifiedProof = result?.proof;
  const isOwner =
    !!owner && walletAddress?.toLowerCase() === owner.toLowerCase();
  const networkName = deployment?.name ?? "Guided demo";
  const nav = [
    { id: "verify", label: "Verify a document", icon: Search },
    { id: "issue", label: "Issue a document", icon: Plus },
    { id: "activity", label: "Your activity", icon: History },
    { id: "guide", label: "How it works", icon: Info },
  ] as const;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <a className="brand" href="#/verify" onClick={() => navigate("verify")}>
          <span className="brand-icon">
            <Fingerprint size={25} />
          </span>
          <span>
            document<span className="brand-second">proof</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "selected" : ""}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              {n.label}
            </button>
          ))}
          {isOwner && (
            <button
              className={`nav-item ${page === "admin" ? "selected" : ""}`}
              onClick={() => navigate("admin")}
            >
              <LockKeyhole size={19} />
              Registry settings
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="version-dot" />
          Open source, independently checkable
          <a
            href="https://github.com/BintangDiLangit/document-proof"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} />
            View the source
            <ArrowUpRight size={15} />
          </a>
          <div className="sidebar-fine">
            File integrity.
            <br />A clearer chain of evidence.
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={22} />
          </button>
          <div className="network-badge">
            <span />
            {networkName}
            <ChevronDown size={13} />
          </div>
          <span className="topbar-note">
            {deployment?.chainId === 31337
              ? "Local test network"
              : deployment
                ? "Public test network"
                : "Simulated records · no on-chain claim"}
          </span>
          <button
            className="wallet-button"
            onClick={() =>
              walletAddress
                ? devWallet
                  ? setDevWallet(null)
                  : disconnect()
                : connectWallet()
            }
            disabled={connecting}
          >
            <Wallet size={17} />
            {connecting
              ? "Connecting…"
              : walletAddress
                ? `${devWallet ? "Dev " : ""}${short(walletAddress)}`
                : "Connect wallet"}
          </button>
        </header>
        <main id="main" tabIndex={-1}>
          {page === "verify" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    A document. A record.
                    <br />A clear answer.
                  </h1>
                  <p>
                    Check that your PDF matches what its issuer registered.
                    <br className="desktop-br" />
                    Your file stays on your device.
                  </p>
                </div>
                <div className="heading-mark" aria-hidden="true">
                  <FileCheck2 size={52} strokeWidth={1.2} />
                  <span>Exact-file verification</span>
                </div>
              </div>
              <div className="verification-grid">
                <section
                  className="input-panel"
                  aria-labelledby="check-heading"
                >
                  <div className="section-heading">
                    <h2 id="check-heading">Check a document</h2>
                    <span className="subtle-chip">No wallet needed</span>
                  </div>
                  <p className="small-text">
                    Open a verification link or choose a receipt, then select
                    the original PDF.
                  </p>
                  <label className="field-label" htmlFor="verification-link">
                    Verification link
                  </label>
                  <div className="link-field">
                    <input
                      id="verification-link"
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      placeholder="Paste a Document Proof link"
                    />
                    <button
                      aria-label="Open verification link"
                      onClick={openLink}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => receiptInput.current?.click()}
                  >
                    <FileText size={16} />
                    Choose a receipt JSON
                  </button>
                  <input
                    ref={receiptInput}
                    className="visually-hidden"
                    tabIndex={-1}
                    type="file"
                    accept=".json,application/json"
                    aria-label="Choose receipt JSON"
                    onChange={importReceipt}
                  />
                  <label
                    className={`dropzone ${fileHash ? "has-file" : ""}`}
                    htmlFor="verify-pdf"
                  >
                    <span className="upload-icon">
                      {fileHash ? (
                        <FileCheck2 size={26} />
                      ) : (
                        <Upload size={26} />
                      )}
                    </span>
                    <strong>{fileName || "Choose the original PDF"}</strong>
                    <span>
                      {fileHash
                        ? "Choose another file to compare"
                        : "PDF up to 20 MB"}
                    </span>
                    <input
                      id="verify-pdf"
                      className="visually-hidden"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={selectPdf}
                    />
                  </label>
                  <div className="privacy-line">
                    <LockKeyhole size={15} />
                    <span>Hashed in your browser. Never uploaded.</span>
                  </div>
                  <div className="sample-area">
                    <h3>Try it with a sample</h3>
                    <p>Fictional certificates, real file comparisons.</p>
                    <div className="sample-buttons">
                      <button onClick={() => sample("original")}>
                        <FileCheck2 size={16} />
                        Original
                      </button>
                      <button onClick={() => sample("altered")}>
                        <FileText size={16} />
                        Altered
                      </button>
                      <button onClick={() => sample("revoked")}>
                        <XCircle size={16} />
                        Revoked
                      </button>
                      <button onClick={() => sample("expired")}>Expired</button>
                    </div>
                    <a
                      className="small-link"
                      href={`${import.meta.env.BASE_URL}samples/original.pdf`}
                      download
                    >
                      Download the original sample
                      <Download size={13} />
                    </a>
                  </div>
                </section>
                <section
                  className={`result-panel ${resultTone}`}
                  aria-labelledby="result-heading"
                  aria-busy={checking}
                >
                  <div className="result-title-row">
                    <h2 id="result-heading">Verification result</h2>
                    <span className="live-label">
                      {deployment ? "Read from chain" : "Guided demo"}
                    </span>
                  </div>
                  <div className="result-summary" aria-live="polite">
                    <div className="result-symbol">
                      {checking ? (
                        <LoaderCircle className="spin" size={32} />
                      ) : bad ? (
                        <XCircle size={32} />
                      ) : matched ? (
                        <CheckCircle2 size={32} />
                      ) : (
                        <Fingerprint size={32} />
                      )}
                    </div>
                    <h3>{headline}</h3>
                    <p>
                      {result?.integrity === "mismatch"
                        ? "These PDF bytes differ from the issuer’s record. Re-exporting or editing a PDF can change its fingerprint."
                        : result?.recordStatus === "revoked"
                          ? "The issuer withdrew this record. A matching file does not restore its active status."
                          : result?.recordStatus === "expired"
                            ? "The document is past its recorded expiry date."
                            : matched
                              ? "The PDF bytes match the recorded fingerprint. Review the issuer and record status below."
                              : "Finding a record alone does not check the contents of your PDF."}
                    </p>
                  </div>
                  {result && (
                    <>
                      <div className="check-list">
                        <div>
                          <span
                            className={`mini-dot ${matched ? "green" : result.integrity === "mismatch" ? "red" : ""}`}
                          />
                          <span>File comparison</span>
                          <strong>
                            {result.integrity === "match"
                              ? "Exact match"
                              : result.integrity === "mismatch"
                                ? "Different file"
                                : "Not checked"}
                          </strong>
                        </div>
                        <div>
                          <span
                            className={`mini-dot ${result.recordStatus === "active" ? "green" : "red"}`}
                          />
                          <span>Record status</span>
                          <strong>
                            {result.recordStatus === "not-found"
                              ? "Not found"
                              : result.recordStatus.charAt(0).toUpperCase() +
                                result.recordStatus.slice(1)}
                          </strong>
                        </div>
                        <div>
                          <span
                            className={`mini-dot ${result.issuerEnabled ? "green" : "red"}`}
                          />
                          <span>Issuer permission</span>
                          <strong>
                            {result.issuerEnabled ? "Enabled" : "Disabled"}
                          </strong>
                        </div>
                      </div>
                      <div className="record-details">
                        <DataRow
                          label="Issuer wallet"
                          value={target?.issuer ?? ""}
                          copy
                        />
                        <button
                          className="small-link issuer-link"
                          onClick={() => navigate("issuer")}
                        >
                          What do we know about this issuer?
                          <ArrowUpRight size={13} />
                        </button>
                        <DataRow
                          label="Issued"
                          value={date(result.record.issuedAt)}
                        />
                        <DataRow
                          label="Expires"
                          value={date(result.record.expiresAt)}
                        />
                        <DataRow
                          label="Checked at block"
                          value={result.block}
                        />
                        <details>
                          <summary>See the technical evidence</summary>
                          <DataRow
                            label="SHA-256"
                            value={result.record.sha256Hash}
                            copy
                          />
                          <DataRow
                            label="Document ID"
                            value={target?.documentId ?? ""}
                            copy
                          />
                          {deployment && (
                            <DataRow
                              label="Registry"
                              value={deployment.registry}
                              copy
                            />
                          )}
                        </details>
                      </div>
                    </>
                  )}
                  <div className="trust-note">
                    <Info size={17} />
                    <p>
                      A matching file proves integrity, not the truth of its
                      contents or an issuer’s accreditation.
                      {!deployment && " This session uses simulated records."}
                    </p>
                  </div>
                  {verifiedProof && (
                    <div className="result-actions">
                      <button
                        className="secondary-button"
                        onClick={() =>
                          download(
                            "document-proof.receipt.json",
                            JSON.stringify(verifiedProof, null, 2),
                          )
                        }
                      >
                        <Download size={16} />
                        Receipt
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setIssued(verifiedProof);
                          navigate("issue");
                        }}
                      >
                        <ExternalLink size={16} />
                        Share proof
                      </button>
                      {walletAddress?.toLowerCase() ===
                        target?.issuer.toLowerCase() &&
                        !result?.record.revoked && (
                          <button
                            className="danger-link"
                            onClick={() => setRevokeReview(true)}
                          >
                            Revoke record
                          </button>
                        )}
                    </div>
                  )}
                </section>
              </div>
              {revokeReview && (
                <section className="notice warning">
                  <h3>Revoke this record permanently?</h3>
                  <p>
                    The original record stays public. Revocation cannot be
                    undone. To correct a document, issue a new one.
                  </p>
                  <div className="inline-actions">
                    <button
                      className="danger-button"
                      disabled={busy || !!pending}
                      onClick={() =>
                        target &&
                        submit("revoke", "revoke", [target.documentId])
                      }
                    >
                      Confirm revocation
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => setRevokeReview(false)}
                    >
                      Keep record
                    </button>
                  </div>
                </section>
              )}
              <div className="bottom-explainer">
                <span>
                  <Fingerprint size={19} />
                  Exact bytes, independent evidence.
                </span>
                <button
                  className="small-link"
                  onClick={() => navigate("guide")}
                >
                  Understand what verification means
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          )}

          {page === "issue" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    Give a document
                    <br />a verifiable record.
                  </h1>
                  <p>Register the final PDF. Share the proof, not the file.</p>
                </div>
              </div>
              {issued ? (
                <section className="issue-panel success-panel">
                  <CheckCircle2 size={35} />
                  <h2>Your proof is ready</h2>
                  <p>
                    The record is published. The QR checks the record; the
                    recipient must still compare their PDF.
                  </p>
                  <div className="share-proof">
                    {qr && (
                      <img
                        src={qr}
                        width="200"
                        height="200"
                        alt="QR code containing the verification link"
                      />
                    )}
                    <div>
                      <label className="field-label">Verification link</label>
                      <div className="share-link">
                        {proofLink(issued, location.href.split("#")[0])}
                        <IconButton
                          value={proofLink(issued, location.href.split("#")[0])}
                          label="Copy verification link"
                        />
                      </div>
                      <div className="inline-actions">
                        <button
                          className="primary-button"
                          onClick={() =>
                            download(
                              "document-proof.receipt.json",
                              JSON.stringify(issued, null, 2),
                            )
                          }
                        >
                          <Download size={16} />
                          Download receipt
                        </button>
                        {qr && (
                          <a
                            className="secondary-button"
                            href={qr}
                            download="document-proof-qr.png"
                          >
                            Download QR
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="text-button"
                      onClick={() => {
                        chooseTarget(issued.issuer, issued.documentId);
                        setIssued(null);
                      }}
                    >
                      Inspect this record
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setIssued(null)}
                    >
                      Issue another document
                    </button>
                  </div>
                </section>
              ) : (
                <section className="issue-panel">
                  <div className="section-heading">
                    <h2>New document</h2>
                    <span className="subtle-chip">One file, one record</span>
                  </div>
                  {!deployment && (
                    <div className="notice">
                      This public preview is a guided demo. Issuance is
                      available after deploying the contract locally or
                      configuring a published testnet deployment.
                    </div>
                  )}
                  {!walletAddress && (
                    <div className="notice">
                      Connect a wallet to issue a document. Verifying documents
                      never needs a wallet.
                    </div>
                  )}
                  {deployment?.chainId === 31337 &&
                    import.meta.env.DEV &&
                    !devWallet && (
                      <button
                        className="secondary-button"
                        onClick={async () => {
                          try {
                            setDevWallet(await localDevWallet());
                          } catch (e) {
                            setError(humanError(e));
                          }
                        }}
                      >
                        Use public local test account
                      </button>
                    )}
                  {devWallet && (
                    <div className="notice warning">
                      Local development account only. This account is public and
                      must never receive funds on a public network.
                    </div>
                  )}
                  {walletAddress && !allowed && deployment && (
                    <div className="notice warning">
                      This wallet does not have permission to issue. Ask the
                      registry administrator to enable it.
                    </div>
                  )}
                  {deployment &&
                    connectedWallet &&
                    !devWallet &&
                    chainId !== deployment.chainId && (
                      <button
                        className="secondary-button"
                        onClick={() =>
                          switchChain({
                            chainId: deployment.chainId as 31337 | 84532,
                          }).catch((e) => setError(humanError(e)))
                        }
                      >
                        Switch to {deployment.name}
                      </button>
                    )}
                  <label className="field-label" htmlFor="issue-pdf">
                    Final PDF
                  </label>
                  <input
                    id="issue-pdf"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={chooseIssueFile}
                    disabled={busy || !!pending}
                  />
                  <p className="field-help">
                    Finish all edits before registration. Adding a QR to this
                    PDF afterwards changes its fingerprint.
                  </p>
                  {issueHash && (
                    <div className="draft-file">
                      <FileText size={23} />
                      <div>
                        <strong>{issueFile}</strong>
                        <span className="mono">
                          {short(issueHash)}{" "}
                          <IconButton
                            value={issueHash}
                            label="Copy document fingerprint"
                          />
                        </span>
                      </div>
                    </div>
                  )}
                  <label className="field-label" htmlFor="expiry">
                    Expiry date <span className="muted">(optional)</span>
                  </label>
                  <input
                    id="expiry"
                    type="datetime-local"
                    value={expiry}
                    onChange={(e) => {
                      setExpiry(e.target.value);
                      setEstimate(null);
                    }}
                    disabled={busy || !!pending}
                  />
                  <div className="privacy-line">
                    <LockKeyhole size={15} />
                    Only the fingerprint and record metadata are stored
                    on-chain.
                  </div>
                  {estimate !== null && (
                    <div className="review-box">
                      <h3>Review before publishing</h3>
                      <DataRow
                        label="Issuer"
                        value={walletAddress ?? ""}
                        copy
                      />
                      <DataRow label="Network" value={networkName} />
                      <DataRow
                        label="Execution gas estimate"
                        value={`${formatEther(estimate)} ETH`}
                      />
                      <p className="field-help">
                        Your wallet shows the transaction fee. Additional
                        network data fees can apply. This estimate is not a
                        price guarantee.
                      </p>
                    </div>
                  )}
                  <div className="inline-actions">
                    <button
                      className="secondary-button"
                      disabled={
                        !deployment ||
                        !wallet ||
                        !allowed ||
                        !issueHash ||
                        reviewing ||
                        busy ||
                        !!pending
                      }
                      onClick={reviewIssue}
                    >
                      {reviewing ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : null}
                      Review transaction
                    </button>
                    <button
                      className="primary-button"
                      disabled={
                        estimate === null || busy || !!pending || !allowed
                      }
                      onClick={() => {
                        try {
                          if (
                            deployment &&
                            walletAddress &&
                            issueId &&
                            issueHash
                          )
                            submit(
                              "issue",
                              "issue",
                              [issueId, issueHash, expiresAt()],
                              {
                                version: 1,
                                chainId: deployment.chainId,
                                registry: deployment.registry,
                                issuer: walletAddress,
                                documentId: issueId,
                                sha256Hash: issueHash,
                              },
                            );
                        } catch (e) {
                          setError(humanError(e));
                        }
                      }}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Plus size={17} />
                      )}
                      Publish record
                    </button>
                  </div>
                </section>
              )}
            </>
          )}

          {page === "activity" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    Your trail
                    <br />
                    of evidence.
                  </h1>
                  <p>Records issued by the connected wallet.</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => loadHistory()}
                  disabled={historyBusy || !walletAddress}
                >
                  Refresh
                </button>
              </div>
              <section className="issue-panel">
                <h2>Issued documents</h2>
                {!deployment ? (
                  <p className="empty-state">
                    Connect a deployed registry to view on-chain activity.
                  </p>
                ) : !walletAddress ? (
                  <p className="empty-state">
                    Connect your wallet to find its issued records.
                  </p>
                ) : historyBusy && !history.length ? (
                  <p className="empty-state">Reading registry events…</p>
                ) : !history.length ? (
                  <p className="empty-state">
                    No records in this block range.{" "}
                    {historyNext !== null
                      ? "Load earlier blocks to keep looking."
                      : "Issue your first document to start your history."}
                  </p>
                ) : (
                  <div className="history-table">
                    {history.map((p) => (
                      <div key={p.documentId}>
                        <FileCheck2 size={21} />
                        <div>
                          <strong>Document {short(p.documentId)}</strong>
                          <span className="mono">{short(p.sha256Hash)}</span>
                        </div>
                        <button
                          className="secondary-button"
                          onClick={() => chooseTarget(p.issuer, p.documentId)}
                        >
                          Check current status
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {historyError && (
                  <p className="error-message">{historyError}</p>
                )}
                {historyNext !== null && (
                  <button
                    className="secondary-button"
                    disabled={historyBusy}
                    onClick={() => loadHistory(true)}
                  >
                    {historyBusy ? "Loading…" : "Load earlier blocks"}
                  </button>
                )}
                <p className="field-help">
                  Current status is checked directly from the registry. History
                  scans at most 2,001 blocks per request.
                </p>
              </section>
            </>
          )}

          {page === "issuer" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    Know what
                    <br />
                    you’re trusting.
                  </h1>
                  <p>
                    Wallet control and organizational identity are different
                    claims.
                  </p>
                </div>
              </div>
              <section className="issue-panel">
                <h2>Issuer information</h2>
                <DataRow
                  label="Wallet"
                  value={target?.issuer ?? "No issuer selected"}
                  copy
                />
                <DataRow
                  label="Registry permission"
                  value={
                    result?.issuerEnabled
                      ? "Enabled"
                      : result
                        ? "Disabled"
                        : "Not checked"
                  }
                />
                <DataRow
                  label="Organization identity"
                  value="Not independently verified"
                />
                <p>
                  An enabled wallet can register records. It does not establish
                  accreditation, legal identity, or ownership of the training
                  provider's name.
                </p>
                {target?.issuer.toLowerCase() ===
                  demo?.issuer.toLowerCase() && (
                  <div className="notice">
                    Open Learning Studio and Alex Example are fictional
                    demonstration identities.
                  </div>
                )}
                <button
                  className="secondary-button"
                  onClick={() => navigate("verify")}
                >
                  Back to verification
                </button>
              </section>
            </>
          )}

          {page === "guide" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    Evidence you
                    <br />
                    can inspect.
                  </h1>
                  <p>Understand the checks, the trust, and the limits.</p>
                </div>
              </div>
              <section className="guide-panel">
                <article>
                  <Fingerprint />
                  <h2>Check the exact file</h2>
                  <p>
                    Your browser calculates a SHA-256 fingerprint from the PDF
                    bytes and compares it to the issuer’s record. Renaming a
                    file does not change its bytes; editing or re-exporting it
                    can.
                  </p>
                </article>
                <article>
                  <ShieldCheck />
                  <h2>Read the current record</h2>
                  <p>
                    The registry records who issued the fingerprint, when it was
                    issued, and whether it has expired or been revoked. Scanning
                    a QR finds the record; choosing the PDF checks the file.
                  </p>
                </article>
                <article>
                  <Info />
                  <h2>Decide whether to trust the issuer</h2>
                  <p>
                    A matching file does not prove that the certificate’s
                    contents are true or that an institution is accredited. Our
                    demo identities are fictional.
                  </p>
                </article>
                <article>
                  <LockKeyhole />
                  <h2>Keep the file on your device</h2>
                  <p>
                    PDFs are not uploaded. Fingerprints, issuer addresses and
                    record timestamps are public on-chain. A fingerprint is not
                    encryption or a guarantee of anonymity. Avoid sensitive
                    documents in this prototype.
                  </p>
                </article>
              </section>
              <section className="issue-panel">
                <h2>Independent verification</h2>
                <p>
                  Download the receipt and use the open-source CLI with the
                  published deployment configuration. Read from another RPC to
                  independently compare the result.
                </p>
                <code className="code-block">
                  pnpm verify deployment.json receipt.json certificate.pdf
                </code>
                <a
                  className="small-link"
                  href="https://github.com/BintangDiLangit/document-proof"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the code and trust model
                  <Github size={16} />
                </a>
              </section>
            </>
          )}

          {page === "admin" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>
                    Registry
                    <br />
                    permissions.
                  </h1>
                  <p>Control which wallets can issue new records.</p>
                </div>
              </div>
              <section className="issue-panel">
                {!isOwner ? (
                  <p>
                    Connect the registry owner wallet to manage issuer
                    permissions.
                  </p>
                ) : (
                  <>
                    <h2>Change issuer permission</h2>
                    <label className="field-label" htmlFor="issuer-address">
                      Issuer wallet address
                    </label>
                    <input
                      id="issuer-address"
                      value={adminAddress}
                      onChange={(e) => setAdminAddress(e.target.value)}
                      placeholder="0x…"
                    />
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={adminEnabled}
                        onChange={(e) => setAdminEnabled(e.target.checked)}
                      />
                      Allow this wallet to issue new records
                    </label>
                    <p>
                      Disabling a wallet prevents new issuance. It does not
                      revoke existing documents, and the issuer can still revoke
                      them.
                    </p>
                    <button
                      className="primary-button"
                      disabled={!isAddress(adminAddress) || busy || !!pending}
                      onClick={() =>
                        submit("permission", "setIssuer", [
                          adminAddress.toLowerCase(),
                          adminEnabled,
                        ])
                      }
                    >
                      Confirm permission change
                    </button>
                  </>
                )}
              </section>
            </>
          )}

          {error && (
            <div className="notice error-message" role="alert">
              <XCircle size={18} />
              <span>{error}</span>
              <button
                className="copy-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {(txMessage || pending) && (
            <section className="transaction-panel" aria-live="polite">
              <div>
                <History size={19} />
                <span>{txMessage}</span>
              </div>
              {pending && (
                <>
                  <div className="mono pending-hash">
                    {pending.hash}
                    <IconButton
                      value={pending.hash}
                      label="Copy transaction hash"
                    />
                  </div>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => watchTransaction(pending)}
                  >
                    {busy ? "Checking…" : "Check receipt again"}
                  </button>
                  {deployment && explorer(deployment, `tx/${pending.hash}`) && (
                    <a
                      className="small-link"
                      href={explorer(deployment, `tx/${pending.hash}`)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open explorer
                      <ExternalLink size={14} />
                    </a>
                  )}
                </>
              )}
            </section>
          )}
          <footer>
            <span>Document Proof · MIT licensed</span>
            <span>
              Built by{" "}
              <a
                href="https://github.com/BintangDiLangit"
                target="_blank"
                rel="noreferrer"
              >
                Bintang
              </a>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
