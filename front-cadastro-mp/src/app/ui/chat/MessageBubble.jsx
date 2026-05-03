// src/app/ui/chat/MessageBubble.jsx

import { downloadFileApi } from "../../api/filesApi";

import { REQUEST_ITEM_FIELD_META } from "../requests/requestItemFields.schema";
import { FIELD_TYPES } from "../../constants";
import "./MessageBubble.css";

/* -------------------------------------------------------------------------- */
/* Utils                                                                      */
/* -------------------------------------------------------------------------- */

function myStatusLabel(status) {
  if (status === "sending") return "Enviando";
  if (status === "sent") return "Enviado";
  return "";
}

function fileLabel(originalName) {
  const ext = (originalName || "").split(".").pop();

  if (!ext || ext === originalName) return "ARQ";

  return String(ext).toUpperCase();
}

function formatFileSize(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) return "";

  if (value < 1024) return `${value} B`;

  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;

  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

function buildFieldMap(fields) {
  const map = {};

  (fields || []).forEach((field) => {
    map[field.field_tag] = field.field_value ?? "";
  });

  return map;
}

function parseSuppliers(jsonStr) {
  if (!jsonStr) return [];

  try {
    const value = JSON.parse(jsonStr);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatDateTime(value) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("pt-BR");
}

/* -------------------------------------------------------------------------- */
/* UI Pieces                                                                  */
/* -------------------------------------------------------------------------- */

function ReadonlyInput({ label, value }) {
  return (
    <div className="cmp-readonly-field">
      <div className="cmp-readonly-field__label">{label}</div>

      <div className="cmp-readonly-field__value">
        {value || <span className="cmp-readonly-field__empty">—</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Request Item Card                                                          */
/* -------------------------------------------------------------------------- */

const REQUEST_TYPE_ID_UPDATE = 2;

function RequestItemReadonlyCard({ item, index }) {
  const fieldMap = buildFieldMap(item.fields);

  const typeName = item?.request_type?.type_name || `#${item.request_type_id}`;
  const statusName =
    item?.request_status?.status_name || `#${item.request_status_id}`;

  const fieldMetaList = Object.values(REQUEST_ITEM_FIELD_META);

  const suppliersMeta = REQUEST_ITEM_FIELD_META.fornecedores;
  const suppliers = parseSuppliers(fieldMap[suppliersMeta.tag]);

  return (
    <article className="cmp-request-readonly-card">
      <header className="cmp-request-readonly-card__header">
        <strong className="cmp-request-readonly-card__title">
          Solicitação · Item #{index + 1}
        </strong>

        <div className="cmp-request-readonly-card__badges">
          <span className="cmp-request-readonly-card__badge">
            Tipo: {typeName}
          </span>

          <span className="cmp-request-readonly-card__badge">
            Status: {statusName}
          </span>
        </div>
      </header>

      <div className="cmp-request-readonly-card__fields">
        {fieldMetaList
          .filter((meta) => meta.field_type_id === FIELD_TYPES.TEXT)
          .filter((meta) => {
            if (meta.tag === "codigo_atual") {
              return item?.request_type_id === REQUEST_TYPE_ID_UPDATE;
            }

            return true;
          })
          .map((meta) => {
            const isDescription = meta.tag === "descricao";

            return (
              <div
                key={meta.tag}
                className={
                  isDescription
                    ? "cmp-request-readonly-card__field cmp-request-readonly-card__field--full"
                    : "cmp-request-readonly-card__field"
                }
              >
                <ReadonlyInput label={meta.label} value={fieldMap[meta.tag]} />
              </div>
            );
          })}
      </div>

      <section className="cmp-request-readonly-card__suppliers">
        <div className="cmp-request-readonly-card__section-title">
          {suppliersMeta.label}
        </div>

        {suppliers.length === 0 ? (
          <div className="cmp-request-readonly-card__empty">—</div>
        ) : (
          <div className="cmp-request-readonly-card__table-wrap">
            <table className="cmp-request-readonly-card__table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Loja</th>
                  <th>Fornecedor</th>
                  <th>Part number</th>
                  <th>Código do Catálogo</th>
                </tr>
              </thead>

              <tbody>
                {suppliers.map((row, supplierIndex) => (
                  <tr key={supplierIndex}>
                    <td>{row.supplier_code || "—"}</td>
                    <td>{row.store || "—"}</td>
                    <td>{row.supplier_name || "—"}</td>
                    <td>{row.part_number || "—"}</td>
                    <td>{row.catalog_number || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Request Stack                                                              */
/* -------------------------------------------------------------------------- */

function RequestReadonlyStack({ requestFull }) {
  const items = requestFull?.items || [];

  if (!items.length) return null;

  return (
    <div className="cmp-request-readonly-stack">
      {items.map((item, index) => (
        <RequestItemReadonlyCard
          key={item.id ?? index}
          item={item}
          index={index}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Message Attachments                                                        */
/* -------------------------------------------------------------------------- */

function MessageAttachment({ file, onDownload }) {
  const isImage = (file.content_type || "").startsWith("image/");
  const preview = file._local_preview_url;
  const extensionLabel = fileLabel(file.original_name);
  const fileSize = formatFileSize(file.size_bytes);

  return (
    <article className="cmp-message-attachment">
      <div className="cmp-message-attachment__preview">
        {isImage && preview ? (
          <img
            src={preview}
            alt={file.original_name}
            className="cmp-message-attachment__image"
          />
        ) : (
          <span className="cmp-message-attachment__label">
            {extensionLabel}
          </span>
        )}
      </div>

      <div className="cmp-message-attachment__body">
        <div className="cmp-message-attachment__name" title={file.original_name}>
          {file.original_name || "Arquivo"}
        </div>

        <div className="cmp-message-attachment__meta">
          <span>{extensionLabel}</span>
          {fileSize ? <span>{fileSize}</span> : null}
        </div>

        <button
          type="button"
          disabled={!file.id}
          onClick={() => onDownload(file)}
          className="cmp-message-attachment__download"
        >
          {file.id ? "Baixar" : "Pendente"}
        </button>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Message Bubble                                                             */
/* -------------------------------------------------------------------------- */

export function MessageBubble({ message, isMine }) {
  const status = message._status ?? (isMine ? "sent" : "received");
  const files = Array.isArray(message.files) ? message.files : [];
  const senderName = message.sender?.full_name ?? message.sender?.email ?? "";
  const createdAt = formatDateTime(message.created_at);
  const statusLabel = myStatusLabel(status);

  async function handleDownload(file) {
    if (!file?.id) return;

    try {
      await downloadFileApi(file.id, file.original_name || "arquivo");
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error ?? "Falha ao baixar arquivo.");
    }
  }

  return (
    <div
      className={
        isMine
          ? "cmp-message-bubble-row cmp-message-bubble-row--mine"
          : "cmp-message-bubble-row"
      }
    >
      <article
        className={[
          "cmp-message-bubble",
          isMine ? "cmp-message-bubble--mine" : "",
          status === "sending" ? "cmp-message-bubble--sending" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {!isMine && senderName ? (
          <div className="cmp-message-bubble__sender">{senderName}</div>
        ) : null}

        {message.body ? (
          <div className="cmp-message-bubble__body">{message.body}</div>
        ) : null}

        {message.request_full ? (
          <RequestReadonlyStack requestFull={message.request_full} />
        ) : null}

        {files.length > 0 ? (
          <div className="cmp-message-bubble__attachments">
            {files.map((file, index) => (
              <MessageAttachment
                key={file.id ?? `${file.original_name}-${index}`}
                file={file}
                onDownload={handleDownload}
              />
            ))}
          </div>
        ) : null}

        <footer className="cmp-message-bubble__footer">
          <time dateTime={message.created_at || undefined}>{createdAt}</time>

          {isMine && statusLabel ? (
            <span
              className={
                status === "sending"
                  ? "cmp-message-bubble__status cmp-message-bubble__status--sending"
                  : "cmp-message-bubble__status"
              }
            >
              {status === "sending" ? "🕓 " : "✓ "}
              {statusLabel}
            </span>
          ) : null}
        </footer>
      </article>
    </div>
  );
}