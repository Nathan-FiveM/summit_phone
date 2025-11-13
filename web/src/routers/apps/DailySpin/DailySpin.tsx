// src/routers/apps/DailySpin/DailySpin.tsx
import { useEffect, useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { Transition, Button, Text } from "@mantine/core";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import Title from "../../components/Title";

interface RouletteItem {
  id: number;
  type: "vehicle" | "item" | "cash" | "bank" | "weapon";
  model: string | number;
  rarity: "legendary" | "epic" | "rare" | "common";
  img: string;
  name: string;
  sell: number;
  quantity?: number;
}

interface DailySpinState {
  userData: {
    canClaim: boolean;
    lastClaimedDisplay: string;
  };
  rouletteData: RouletteItem[];
  probability: Record<"legendary" | "epic" | "rare" | "common", number>;
  animationDuration: number;
}

export default function DailySpin(props: { onExit: () => void; onEnter: () => void }) {
  const nodeRef = useRef(null);
  const { location, setLocation } = usePhone();

  const [state, setState] = useState<DailySpinState | null>(null);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<RouletteItem | null>(null);

  const [isReeling, setIsReeling] = useState(false);
  const [reelItems, setReelItems] = useState<RouletteItem[]>([]);
  const reelRef = useRef<HTMLDivElement>(null);
  const [flashWinner, setFlashWinner] = useState(false);
  const [particles, setParticles] = useState<{ id: number }[]>([]);


  // load state from NUI when entering
  const loadState = async () => {
    setLoading(true);
    const res = await fetchNui<string>("dailySpin:getState", {});
    if (res) {
      const parsed = JSON.parse(res) as {
        userData: { canClaim: boolean; lastClaimedDisplay: string };
        rouletteData: Record<string, RouletteItem>;
        probability: DailySpinState["probability"];
        animationDuration: number;
      };

      const rouletteArray = Object.values(parsed.rouletteData);

      setState({
        userData: parsed.userData,
        rouletteData: rouletteArray,
        probability: parsed.probability,
        animationDuration: parsed.animationDuration,
      });
    }
    setLoading(false);
  };

  const isVisible = location.app === "dailyspins";

  const weightedRandomItem = () => {
    if (!state) return null;
    const { rouletteData, probability } = state;

    const rarities: Array<keyof typeof probability> = [
      "legendary",
      "epic",
      "rare",
      "common",
    ];

    const roll = Math.random();
    let cumulative = 0;
    let chosenRarity: keyof typeof probability = "common";

    for (const r of rarities) {
      cumulative += probability[r];
      if (roll <= cumulative) {
        chosenRarity = r;
        break;
      }
    }

    const candidates = rouletteData.filter((i) => i.rarity === chosenRarity);
    if (!candidates.length) return rouletteData[Math.floor(Math.random() * rouletteData.length)];
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const handleSpin = async () => {
    if (!state || !state.userData.canClaim || spinning || isReeling) return;

    setSpinning(true);
    setIsReeling(true);

    await fetchNui("dailySpin:claim", {});

    const item = weightedRandomItem();
    if (!item) return;

    // Build long reel
    let reelList: RouletteItem[] = [];
    for (let i = 0; i < 40; i++) {
      reelList.push(
        state.rouletteData[Math.floor(Math.random() * state.rouletteData.length)]
      );
    }
    reelList.push(item);
    setReelItems(reelList);

    setTimeout(() => {
      const reel = reelRef.current;
      if (!reel) return;

      const reelHeight = reel.scrollHeight;
      const stopPos = reelHeight - 240;

      // CASINO EASING: fast → slow → bounce
      reel.style.transition =
        "transform 3.2s cubic-bezier(0.12, 0.82, 0.18, 1.24)";
      reel.style.transform = `translateY(-${stopPos}px)`;

      // WINNER FLASH EFFECT
      setTimeout(() => {
        setFlashWinner(true);
        setTimeout(() => setFlashWinner(false), 600);
      }, 3000);

      // PARTICLES (sparkle burst)
      setTimeout(() => {
        const burst = Array.from({ length: 12 }).map((_, i) => ({ id: i }));
        setParticles(burst);
        setTimeout(() => setParticles([]), 800);
      }, 3000);

      // AFTER ANIMATION
      setTimeout(() => {
        setWinner(item);
        setIsReeling(false);
        setSpinning(false);
        reel.style.transition = "";
        reel.style.transform = "";
      }, 3500);
    }, 50);
  };

  const handleCollect = async () => {
    if (!winner) return;
    await fetchNui("dailySpin:reward", { id: winner.id });
    setWinner(null);
  };

  const handleSell = async () => {
    if (!winner) return;
    await fetchNui("dailySpin:sell", { id: winner.id });
    setWinner(null);
  };

  return (
    <CSSTransition
      nodeRef={nodeRef}
      in={isVisible}
      timeout={450}
      classNames="enterandexitfromtop"
      unmountOnExit
      mountOnEnter
      onEntering={async () => {
        props.onEnter();
        setLocation({
          app: "dailyspins",
          page: {
            ...location.page,
            dailyspins: "main",
          } as any,
        });
        await loadState();
      }}
      onExited={() => {
        props.onExit();
        setLocation({
          app: location.app,
          page: {
            ...location.page,
            dailyspins: "",
          } as any,
        });
        setWinner(null);
      }}
    >
      <div
        ref={nodeRef}
        style={{
          backgroundColor: "#0E0E0E",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Transition
          mounted={isVisible}
          transition="scale-x"
          duration={400}
          timingFunction="ease"
        >
          {(styles) => (
            <div
              style={{
                ...styles,
                width: "100%",
                height: "90%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "absolute",
                zIndex: 1,
              }}
            >
              {/* Header */}
              <div
                style={{
                  width: "90%",
                  marginTop: "3.56vh",
                  letterSpacing: "0.12vh",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Title title="Daily Bonus" />
              </div>

              {/* Spin Section */}
              <div
                style={{
                  width: "90%",
                  marginTop: "2vh",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1vh",
                }}
              >
                {loading || !state ? (
                  <Text c="gray.4" size="1.4vh">
                    Loading rewards...
                  </Text>
                ) : (
                  <>
                    <Button
                      size="md"
                      radius="0.8vh"
                      fullWidth={false}
                      style={{ width: "60%" }}
                      className="spin-button"
                      disabled={!state.userData.canClaim || spinning}
                      onClick={handleSpin}
                    >
                      {spinning
                        ? "Spinning..."
                        : state.userData.canClaim
                        ? "SPIN"
                        : state.userData.lastClaimedDisplay}
                    </Button>
                    <Text c="gray.5" size="1.2vh">
                      You can spin once every 24 hours
                    </Text>
                  </>
                )}
              </div>

              {/* SLOT MACHINE REEL */}
              {isReeling && (
                <div
                  className="casino-reel-frame"
                  style={{
                    width: "90%",
                    height: "42vh",
                    overflow: "hidden",
                    borderRadius: "1.6vh",
                    marginTop: "2vh",
                    position: "relative",
                  }}
                >
                  {/* Neon border glow */}
                  <div className="casino-neon-border" />

                  {/* Actual reel */}
                  <div
                    ref={reelRef}
                    className="casino-reel"
                    style={{
                      position: "absolute",
                      width: "100%",
                      top: 0,
                      left: 0,
                    }}
                  >
                    {reelItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="casino-reel-item"
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          height: "10vh",
                          background: "#111",
                          borderBottom: "0.2vh solid rgba(255,255,255,0.06)"
                        }}
                      >
                        <div
                          style={{
                            width: "40%",
                            backgroundImage: `url(${item.img})`,
                            backgroundSize: "contain",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center",
                            filter: "brightness(1.1)"
                          }}
                        />
                        <div
                          style={{
                            padding: "1vh",
                            width: "60%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center"
                          }}
                        >
                          <Text fw={700} size="1.5vh" c="white">
                            {item.name}
                          </Text>
                          <Text size="1.2vh" c="gray.4">
                            {item.type}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Winner flash overlay */}
                  {flashWinner && <div className="winner-flash" />}

                  {/* Particle burst */}
                  {particles.map((p) => (
                    <div key={p.id} className="particle" />
                  ))}
                </div>
              )}


              {/* Prize List */}
              {!isReeling && state && (
                <div
                  style={{
                    width: "90%",
                    marginTop: "2vh",
                    flex: 1,
                    overflowY: "auto",
                  }}
                >
                  <Text fw={700} size="1.6vh" mb="1vh">
                    Prize List
                  </Text>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.2vh",
                      paddingBottom: "2vh"
                    }}
                  >
                    {state.rouletteData.map((item) => {
                      const rarityLabel =
                        item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1);

                      return (
                        <div
                          key={item.id}
                          className={`reward-card rarity-${item.rarity}`}
                          style={{
                            width: "100%",
                            minHeight: "14vh",
                            borderRadius: "1.3vh",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "row",
                            backgroundColor: "#181818",
                            border: "0.2vh solid transparent",
                          }}
                        >
                          {/* LEFT IMAGE */}
                            <div
                              style={{
                                width: "45%",               // ⬅ bigger image area
                                backgroundImage: `url(${item.img})`,
                                backgroundSize: "contain",   // ⬅ show full item
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "center",
                                backgroundColor: "#111",     // looks cleaner for transparent PNGs
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            />

                            {/* RIGHT CONTENT */}
                            <div
                              style={{
                                padding: "1.3vh",
                                width: "55%",               // ⬅ text stays balanced
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                              }}
                            >

                            {/* NAME */}
                            <Text fw={700} size="1.6vh" c="white">
                              {item.name}
                            </Text>

                            {/* TYPE */}
                            <Text size="1.3vh" c="gray.4" mt="0.2vh">
                              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                            </Text>

                            {/* QUANTITY (if item) */}
                            {item.quantity && (
                              <Text size="1.3vh" c="gray.5">
                                Qty: {item.quantity}
                              </Text>
                            )}

                            {/* RARITY BADGE */}
                            <div className={`rarity-badge rarity-${item.rarity}`}>
                              {rarityLabel}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


              {/* Simple winner overlay */}
              {winner && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.75)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2vh",
                    zIndex: 5,
                  }}
                >
                  <Text fw={700} size="2vh" mb="1vh">
                    🎉 Congratulations!
                  </Text>
                  <div
                    className={`item-won-svg item-won-shadow-${winner.rarity} ${winner.rarity}-svg`}
                    style={{ marginBottom: "1vh" }}
                  >
                    {/* you can replace this with your fancy SVG later */}
                    <img
                      src={winner.img}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        borderRadius: "1vh",
                      }}
                    />
                  </div>
                  <Text fw={600} size="1.6vh" mb="1vh" className="item-won-name">
                    {winner.name}
                  </Text>
                  <Text size="1.3vh" c="gray.3" mb="1vh">
                    Sell value: ${winner.sell.toLocaleString()}
                  </Text>
                  <div
                    style={{
                      display: "flex",
                      gap: "1vh",
                      marginTop: "1vh",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "1vh",
                        marginTop: "2vh",
                        width: "100%",
                        justifyContent: "center",
                      }}
                    >
                      <Button
                        size="md"
                        radius="1vh"
                        style={{
                          width: "40%",
                          backgroundColor: "#d9534f",        // red danger
                          color: "white",
                          fontWeight: 700,
                          boxShadow: "0 0.4vh 1vh rgba(0,0,0,0.4)",
                        }}
                        onClick={handleSell}
                      >
                        Sell for ${winner.sell}
                      </Button>

                      <Button
                        size="md"
                        radius="1vh"
                        style={{
                          width: "40%",
                          backgroundColor: "#2ecc71",        // green collect
                          color: "white",
                          fontWeight: 700,
                          boxShadow: "0 0.4vh 1vh rgba(0,0,0,0.4)",
                        }}
                        onClick={handleCollect}
                      >
                        Collect
                      </Button>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}
        </Transition>
      </div>
    </CSSTransition>
  );
}