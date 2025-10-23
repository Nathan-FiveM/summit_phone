import { useRef, useState, useEffect } from "react";
import { CSSTransition } from "react-transition-group";
import {
  Autocomplete,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import { useNuiEvent } from "../../../hooks/useNuiEvent";

interface CryptoBalances {
  shung: number;
  gne: number;
  xcoin: number;
  lme: number;
}

const themeColors = {
  background: "#0E0E0E",
  card: "#1A1A1A",
  input: "#303030",
  label: "#FFA726",
  text: "#FFFFFF",
  secondaryText: "#CFCFCF",
  buttonBuy: "#FFA726",
  buttonSell: "#E53935",
  buttonTransfer: "#757575",
  borderGlow: "#FFA72633",
  hoverGlow: "#FFA72655",
};

export default function Crypto(props: { onEnter: () => void; onExit: () => void }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const { location } = usePhone();

  const [cryptoBalances, setCryptoBalances] = useState<CryptoBalances>({
    shung: 0,
    gne: 0,
    xcoin: 0,
    lme: 0,
  });
  const [formData, setFormData] = useState({ type: "", amount: 0, price: 1, target: "" });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const cryptoPrices: Record<string, number> = {
    shung: 50,
    gne: 100,
    xcoin: 150,
    lme: 200,
  };

  const [totalValue, setTotalValue] = useState(0);

  const updateBalances = async () => {
    setFetching(true);
    const res = await fetchNui<string>("crypto:getBalances");
    if (res) {
      try {
        setCryptoBalances(JSON.parse(res));
      } catch (err) {
        console.error("Failed to parse crypto balances:", err);
      }
    }
    setFetching(false);
  };

  useNuiEvent("updateCrypto", (data: { type: string; amount: number; action: "add" | "remove" }) => {
    setCryptoBalances((prev) => ({
      ...prev,
      [data.type]:
        data.action === "add"
          ? prev[data.type as keyof typeof prev] + data.amount
          : prev[data.type as keyof typeof prev] - data.amount,
    }));
  });
  useEffect(() => {
    if (location.app === "crypto") {
      updateBalances();
    }
  }, [location.app]);

  useEffect(() => {
    if (formData.type && cryptoPrices[formData.type]) {
      setTotalValue(formData.amount * cryptoPrices[formData.type]);
    } else {
      setTotalValue(0);
    }
  }, [formData.type, formData.amount]);

  const handleTypeChange = (value: string | null) => {
    const price = value && cryptoPrices[value] ? cryptoPrices[value] : 1;
    setFormData({ ...formData, type: value || "", price });
  };

  const doTransaction = async (eventName: string, successMsg: string, failMsg: string) => {
    if (!formData.type || formData.amount <= 0) return;
    setLoading(true);
    const res = await fetchNui<boolean>(eventName, JSON.stringify(formData));
    setLoading(false);
    if (res) {
      fetchNui("showNoti", { app: "crypto", title: "Crypto Success", description: successMsg });
      setFormData({ ...formData, amount: 0, target: "" });
      await updateBalances();
    } else {
      fetchNui("showNoti", { app: "crypto", title: "Crypto Error", description: failMsg });
    }
  };

  const handleBuy = () =>
    doTransaction(
      "crypto:buy",
      `Bought ${formData.amount} ${formData.type.toUpperCase()} for $${totalValue}`,
      "Failed to buy!"
    );

  const handleSell = () =>
    doTransaction(
      "crypto:sell",
      `Sold ${formData.amount} ${formData.type.toUpperCase()} for $${totalValue}`,
      "Failed to sell!"
    );

  const handleTransfer = () =>
    doTransaction(
      "crypto:transfer",
      `Transferred ${formData.amount} ${formData.type.toUpperCase()} to ${formData.target}`,
      "Failed to transfer!"
    );

  return (
    <CSSTransition
      nodeRef={nodeRef}
      in={location.app === "crypto"}
      timeout={450}
      classNames="enterandexitfromtop"
      unmountOnExit
      mountOnEnter
      onEntering={props.onEnter}
      onExited={props.onExit}
    >
      <div
        ref={nodeRef}
        style={{
          backgroundColor: themeColors.background,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "2vh 1.5vh",
          color: themeColors.text,
          overflowY: "auto",
        }}
      >
        <Title order={3} style={{ textAlign: "center", marginBottom: "1.5vh", color: themeColors.label }}>
          Crypto Wallet
        </Title>

        {fetching ? (
          <div style={{ height: "70%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader color={themeColors.label} />
          </div>
        ) : (
          <>
            {/* Crypto Cards */}
            <Group justify="center" gap="sm" style={{ flexWrap: "wrap" }}>
              {Object.entries(cryptoBalances)
                .sort(([aKey], [bKey]) => (cryptoPrices[aKey] || 0) - (cryptoPrices[bKey] || 0))
                .map(([key, value]) => (
                  <Card
                    key={key}
                    shadow="sm"
                    radius="md"
                    style={{
                      backgroundColor: themeColors.card,
                      border: `1px solid ${themeColors.borderGlow}`,
                      minWidth: "40%",
                      margin: "0.5vh",
                      textAlign: "center",
                      transition: "transform 0.2s, box-shadow 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "scale(1.05)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 10px ${themeColors.hoverGlow}`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                    }}
                  >
                    <Text fw={600} fz="1.6vh" c={themeColors.label}>
                      {key.toUpperCase()}
                    </Text>
                    <Text fz="2vh" c={themeColors.label}>
                      {value}
                    </Text>
                    <Text fz="1.2vh" c={themeColors.secondaryText}>
                      ${cryptoPrices[key]}
                    </Text>
                  </Card>
                ))}
            </Group>

            {/* Actions */}
            <Card radius="md" p="1.5vh" style={{ backgroundColor: themeColors.card }}>
              <Stack gap="1.5vh">
                <Select
                  label="Crypto Type"
                  placeholder="Select type"
                  data={Object.keys(cryptoBalances)}
                  value={formData.type}
                  onChange={handleTypeChange}
                  styles={{
                    input: {
                      backgroundColor: themeColors.input,
                      color: themeColors.text,
                      borderRadius: "0.5vh",
                      "::placeholder": { color: themeColors.secondaryText }, // ✅ correct
                    },
                    label: { color: themeColors.label },
                  }}
                />

                <NumberInput
                  label="Amount"
                  value={formData.amount}
                  onChange={(value: number | "") =>
                    setFormData({ ...formData, amount: typeof value === "number" ? value : 0 })
                  }
                  min={0}
                  styles={{
                    input: {
                      backgroundColor: themeColors.input,
                      color: themeColors.text,
                      borderRadius: "0.5vh",
                      "::placeholder": { color: themeColors.secondaryText }, // ✅ correct
                    },
                    label: { color: themeColors.label },
                  }}
                />

                <Text fz="1.5vh" mt="0.5vh" c={themeColors.label}>
                  Total Value: ${totalValue.toFixed(2)}
                </Text>

                <NumberInput
                  label="Transfer Target"
                  placeholder="Server ID"
                  value={formData.target ? Number(formData.target) : undefined}
                  onChange={(value) =>
                    setFormData({ ...formData, target: value ? value.toString() : "" })
                  }
                  min={0}
                  styles={{
                    input: {
                      backgroundColor: themeColors.input,
                      color: themeColors.text,
                      borderRadius: "0.5vh",
                      "::placeholder": { color: themeColors.secondaryText },
                    },
                    label: { color: themeColors.label },
                  }}
                />


                <Group grow>
                  {[
                    { label: "Buy", color: themeColors.buttonBuy, onClick: handleBuy },
                    { label: "Sell", color: themeColors.buttonSell, onClick: handleSell },
                    { label: "Transfer", color: themeColors.buttonTransfer, onClick: handleTransfer },
                  ].map((btn) => (
                    <Button
                      key={btn.label}
                      color={btn.color}
                      onClick={btn.onClick}
                      loading={loading}
                      disabled={
                        !formData.type ||
                        formData.amount <= 0 ||
                        (btn.label === "Transfer" && !formData.target)
                      }
                      style={{
                        transition: "transform 0.15s, box-shadow 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 10px ${themeColors.hoverGlow}`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                      }}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </Group>
              </Stack>
            </Card>
          </>
        )}
      </div>
    </CSSTransition>
  );
}