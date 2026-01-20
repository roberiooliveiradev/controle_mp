// src/app/ui/chat/MessageBubble.jsx

function myStatusLabel(status) {
  if (status === "sending") return "🕓 Enviando";
  if (status === "sent") return "✓ Enviado";
  return "";
}

function fileLabel(originalName) {
  const ext = (originalName || "").split(".").pop();
  if (!ext || ext === originalName) return "ARQ";
  return String(ext).toUpperCase();
}

const FIELD_LABELS = {
  codigo_atual: "Código atual",
  grupo: "Grupo",
  novo_codigo: "Novo código",
  descricao: "Descrição",
  tipo: "Tipo",
  armazem_padrao: "Armazém padrão",
  unidade: "Unidade",
  produto_terceiro: "Produto de 3º?",
  cta_contabil: "Cta. Contábil",
  ref_cliente: "Ref. Cliente",
  fornecedores: "Fornecedores",
};



function fieldsToMap(fields) {
  const map = {};
  (fields || []).forEach((f) => {
    map[f.field_tag] = f.field_value ?? "";
  });
  return map;
}

function parseSuppliers(jsonStr) {
  if (!jsonStr) return [];
  try {
    const v = JSON.parse(jsonStr);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function ReadonlyInput({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div
        style={{
          padding: "10px 10px",
          borderRadius: 10,
          border: "1px solid #eee",
          background: "#fafafa",
          whiteSpace: "pre-wrap",
        }}
      >
        {value || <span style={{ opacity: 0.5 }}>—</span>}
      </div>
    </div>
  );
}

function RequestItemReadonlyCard({ item, index }) {
  const map = fieldsToMap(item.fields);
  const suppliers = parseSuppliers(map.fornecedores);

  const typeName = item?.request_type?.type_name || `#${item.request_type_id}`;
  const statusName = item?.request_status?.status_name || `#${item.request_status_id}`;
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 14,
        padding: 12,
        background: "#fff",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>Solicitação • Item #{index + 1}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid #eee",
              background: "#fafafa",
              opacity: 0.9,
              fontWeight: 700,
            }}
          >
            Tipo: {typeName}
          </span>

          <span
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 999,
              border: "1px solid #eee",
              background: "#fafafa",
              opacity: 0.9,
            }}
          >
            Status: {statusName}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10 }}>
        <ReadonlyInput label={FIELD_LABELS.codigo_atual} value={map.codigo_atual} />
        <ReadonlyInput label={FIELD_LABELS.grupo} value={map.grupo} />
        <ReadonlyInput label={FIELD_LABELS.novo_codigo} value={map.novo_codigo} />
        <div style={{ gridColumn: "1 / -1" }}>
          <ReadonlyInput label={FIELD_LABELS.descricao} value={map.descricao} />
        </div>
        <ReadonlyInput label={FIELD_LABELS.tipo} value={map.tipo} />
        <ReadonlyInput label={FIELD_LABELS.armazem_padrao} value={map.armazem_padrao} />
        <ReadonlyInput label={FIELD_LABELS.unidade} value={map.unidade} />
        <ReadonlyInput label={FIELD_LABELS.produto_terceiro} value={map.produto_terceiro} />
        <ReadonlyInput label={FIELD_LABELS.cta_contabil} value={map.cta_contabil} />
        <ReadonlyInput label={FIELD_LABELS.ref_cliente} value={map.ref_cliente} />
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Fornecedores</div>

        {suppliers.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.65 }}>—</div>
        ) : (
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Código</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Loja</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Nome</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: 8 }}>Part. Number</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{r.supplier_code || "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{r.store || "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{r.supplier_name || "—"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f3f3" }}>{r.part_number || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestReadonlyStack({ requestFull }) {
  const items = requestFull?.items || [];
  if (!items.length) return null;

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, idx) => (
        <RequestItemReadonlyCard key={it.id ?? idx} item={it} index={idx} />
      ))}
    </div>
  );
}

export function MessageBubble({ message, isMine }) {
  const dt = message.created_at ? new Date(message.created_at) : null;
  const status = message._status ?? (isMine ? "sent" : "received");
  const files = Array.isArray(message.files) ? message.files : [];

  return (
    <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div
        style={{
          maxWidth: 780,
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid #eee",
          background: isMine ? "#f6f6f6" : "#fff",
          opacity: status === "sending" ? 0.75 : 1,
        }}
      >
        {!isMine && (
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            {message.sender?.full_name ?? message.sender?.email}
          </div>
        )}

        {message.body ? <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div> : null}

        {/* ✅ stack de forms read-only quando for Request */}
        {message.request_full ? <RequestReadonlyStack requestFull={message.request_full} /> : null}

        {files.length > 0 ? (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {files.map((f, idx) => {
              const isImg = (f.content_type || "").startsWith("image/");
              const preview = f._local_preview_url;

              return (
                <div
                  key={f.id ?? `${f.original_name}-${idx}`}
                  title={f.original_name}
                  style={{
                    width: 160,
                    border: "1px solid #eee",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      height: 96,
                      background: "#f7f7f7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isImg && preview ? (
                      <img
                        src={preview}
                        alt={f.original_name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
                        {fileLabel(f.original_name)}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      padding: 8,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {f.original_name}
                  </div>

                  {f._status ? (
                    <div style={{ padding: "0 8px 8px", fontSize: 11, opacity: 0.65 }}>
                      {f._status === "pending" ? "🕓 Anexo pendente" : ""}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 11,
            opacity: 0.65,
            marginTop: 8,
          }}
        >
          <span>{dt ? dt.toLocaleString("pt-BR") : ""}</span>
          {isMine ? <span>{myStatusLabel(status)}</span> : null}
        </div>
      </div>
    </div>
  );
}
