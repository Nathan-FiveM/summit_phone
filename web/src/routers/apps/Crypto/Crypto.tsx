import { useRef, useState, useEffect } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { Autocomplete, Avatar, Button, Checkbox, NumberFormatter, NumberInput, Select, Textarea, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { PhoneContacts } from "../../../../../types/types";
import { useNuiEvent } from "../../../hooks/useNuiEvent";
import Navigation from "./Navigation";
import { useLocalStorage } from "@mantine/hooks";

export default function Crypto(props: { onEnter: () => void, onExit: () => void }) {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setLocation } = usePhone();
    const [cryptoBalances, setCryptoBalances] = useState({ shung: 0, gne: 0, xcoin: 0, lme: 0 });
    const [contacts, setContacts] = useState<PhoneContacts[]>([]);
    const [formData, setFormData] = useState({ type: '', amount: 0, target: '', price: 1 });
    const [loading, setLoading] = useState(false);

    useNuiEvent('updateCrypto', (data: { type: string; amount: number; action: 'add' | 'remove' }) => {
        setCryptoBalances(prev => ({
            ...prev,
            [data.type]: data.action === 'add' ? prev[data.type as keyof typeof prev] + data.amount : prev[data.type as keyof typeof prev] - data.amount,
        }));
    });

    const fetchBalances = async () => {
        const res = await fetchNui<string>('crypto:getBalances');
        if (res && typeof res === 'string') {
            try {
                setCryptoBalances(JSON.parse(res));
            } catch (error) {
                console.error('Failed to parse crypto balances:', error);
            }
        }
    };

    const fetchContacts = async () => {
        const res = await fetchNui<string>('getContacts');
        if (res && typeof res === 'string') {
            try {
                setContacts(JSON.parse(res));
            } catch (error) {
                console.error('Failed to parse contacts:', error);
            }
        }
    };

    useEffect(() => {
        fetchBalances();
        fetchContacts();
    }, []);

    const handleBuy = async () => {
        if (!formData.type || formData.amount <= 0 || formData.price <= 0) return;
        setLoading(true);
        const res = await fetchNui<boolean>('crypto:buy', JSON.stringify(formData));
        setLoading(false);
        if (res) {
            fetchNui('showNoti', { app: 'crypto', title: 'Crypto Success', description: 'Bought crypto!' });
            fetchBalances();
        } else {
            fetchNui('showNoti', { app: 'crypto', title: 'Crypto Error', description: 'Failed to buy!' });
        }
    };

    const handleSell = async () => {
        if (!formData.type || formData.amount <= 0 || formData.price <= 0) return;
        setLoading(true);
        const res = await fetchNui<boolean>('crypto:sell', JSON.stringify(formData));
        setLoading(false);
        if (res) {
            fetchNui('showNoti', { app: 'crypto', title: 'Crypto Success', description: 'Sold crypto!' });
            fetchBalances();
        } else {
            fetchNui('showNoti', { app: 'crypto', title: 'Crypto Error', description: 'Failed to sell!' });
        }
    };

    const handleTransfer = async () => {
        if (!formData.type || formData.amount <= 0 || !formData.target) return;
        setLoading(true);
        const res = await fetchNui<boolean>('crypto:transfer', JSON.stringify(formData));
        setLoading(false);
        if (res) {
            fetchNui('showNoti', { app: 'crypto', title: 'Crypto Success', description: 'Transferred crypto!' });
            fetchBalances();
        } else {
            fetchNui('showNoti', { app: 'crypto', title: 'Crypto Error', description: 'Failed to transfer!' });
        }
    };

    const page = location.page.crypto || 'home';

    return (
        <CSSTransition nodeRef={nodeRef} in={true} timeout={250} classNames="swipeinleft" appear unmountOnExit onEnter={onEnter} onExit={onExit}>
            <div ref={nodeRef} className="fuckerMessager">
                {page === 'home' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1vh', marginTop: '5vh' }}>
                        <NumberFormatter prefix="SHUNG: " value={cryptoBalances.shung} thousandSeparator />
                        <NumberFormatter prefix="GNE: " value={cryptoBalances.gne} thousandSeparator />
                        <NumberFormatter prefix="XCOIN: " value={cryptoBalances.xcoin} thousandSeparator />
                        <NumberFormatter prefix="LME: " value={cryptoBalances.lme} thousandSeparator />
                    </div>
                )}
                {page === 'buy' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1vh', marginTop: '5vh' }}>
                        <Select data={["shung", "gne", "xcoin", "lme"]} value={formData.type} onChange={(v) => setFormData({ ...formData, type: v || '' })} placeholder="Select Crypto" />
                        <NumberInput value={formData.amount} onChange={(v) => setFormData({ ...formData, amount: Number(v) })} placeholder="Amount" min={1} />
                        <NumberInput value={formData.price} onChange={(v) => setFormData({ ...formData, price: Number(v) })} placeholder="Price per Unit" min={1} />
                        <Button onClick={handleBuy} loading={loading}>Buy</Button>
                    </div>
                )}
                {page === 'sell' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1vh', marginTop: '5vh' }}>
                        <Select data={["shung", "gne", "xcoin", "lme"]} value={formData.type} onChange={(v) => setFormData({ ...formData, type: v || '' })} placeholder="Select Crypto" />
                        <NumberInput value={formData.amount} onChange={(v) => setFormData({ ...formData, amount: Number(v) })} placeholder="Amount" min={1} />
                        <NumberInput value={formData.price} onChange={(v) => setFormData({ ...formData, price: Number(v) })} placeholder="Price per Unit" min={1} />
                        <Button onClick={handleSell} loading={loading}>Sell</Button>
                    </div>
                )}
                {page === 'transfer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1vh', marginTop: '5vh' }}>
                        <Select data={["shung", "gne", "xcoin", "lme"]} value={formData.type} onChange={(v) => setFormData({ ...formData, type: v || '' })} placeholder="Select Crypto" />
                        <NumberInput value={formData.amount} onChange={(v) => setFormData({ ...formData, amount: Number(v) })} placeholder="Amount" min={1} />
                        <Autocomplete placeholder="Target Phone" data={contacts.map(c => c.contactNumber)} value={formData.target} onChange={(v) => setFormData({ ...formData, target: v })} />
                        <Button onClick={handleTransfer} loading={loading}>Transfer</Button>
                    </div>
                )}
                {page !== '' && (
                    <Navigation location={page} onClick={(e) => setLocation({ app: 'crypto', page: { ...location.page, crypto: e } })} />
                )}
            </div>
        </CSSTransition>
    );
}