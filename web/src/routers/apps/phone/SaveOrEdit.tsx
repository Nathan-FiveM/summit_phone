import { Avatar, NumberInput, Textarea, TextInput, Transition } from "@mantine/core";
import { generateUUid } from "../../../hooks/misc";
import { PhoneContacts } from "../../../../../types/types";
import { fetchNui } from "../../../hooks/fetchNui";
import { useState } from "react";
import { usePhone } from "../../../store/store";

export default function SaveOrEdit(props: { data: PhoneContacts, onCancel(): void, visible: boolean, onDone(data: PhoneContacts): void }) {
    const { selectedContact } = usePhone();
    const [image, setImage] = useState(selectedContact.image);
    const [firstName, setFirstName] = useState(selectedContact.firstName);
    const [lastName, setLastName] = useState(selectedContact.lastName);
    const [phoneNumber, setPhoneNumber] = useState(selectedContact.contactNumber);
    const [email, setEmail] = useState(selectedContact.email);
    const [notes, setNotes] = useState(selectedContact.notes);

    return (
        <Transition
            mounted={props.visible}
            transition="slide-up"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => (
                <div style={{
                    ...styles,
                    position: 'absolute',
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '80%',
                    width: '100%',
                    backgroundColor: "#1C1C1E",
                    borderRadius: '0.93vh 0.93vh 3.98vh 3.98vh'
                }}>
                    <div className="save-or-edit-top-buttons">
                        <div onClick={() => {
                            props.onCancel();
                        }} className="cancel clickanimation">
                            Cancel
                        </div>
                        <div className="newContact">
                            {selectedContact._id ? 'Edit Contact' : 'New Contact'}
                        </div>
                        <div onClick={() => {
                            if (!firstName || !lastName || !phoneNumber) return;
                            props.onDone({
                                _id: selectedContact._id || generateUUid(),
                                firstName: firstName,
                                lastName: lastName,
                                contactNumber: phoneNumber,
                                email: email,
                                personalNumber: selectedContact.personalNumber,
                                ownerId: selectedContact.ownerId,
                                notes: notes,
                                image: image,
                                isFav: selectedContact.isFav || false
                            })
                        }} className="done clickanimation">
                            Done
                        </div>
                    </div>
                    <Avatar
                        src={image ?? "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"}
                        size={'11.76vh'}
                        mt={'1.85vh'}
                    />
                    <TextInput value={image} placeholder="Photo URL" styles={{
                        input: {
                            width: '20.00vh',
                            minHeight: '1.39vh',
                            height: '1.85vh',
                            border: 'none',
                            background: '#313035',
                            borderRadius: '0.28vh',
                            marginTop: '0.89vh',
                            fontFamily: 'SFPro',
                            fontStyle: 'normal',
                            fontWeight: 500,
                            fontSize: '0.93vh',
                            lineHeight: '1.02vh',
                            letterSpacing: '0.04em',
                            color: 'rgba(255, 255, 255, 0.5)'
                        }
                    }}
                        onFocus={() => fetchNui('disableControls', true)}
                        onBlur={() => fetchNui('disableControls', false)}
                        onChange={(e) => setImage(e.currentTarget.value)}
                    />
                    <TextInput value={firstName} placeholder="First Name" w={'100%'} h={'2.78vh'} mt={'1.85vh'} styles={{
                        input: {
                            width: '100%',
                            minHeight: '1.39vh',
                            height: '2.78vh',
                            border: 'none',
                            background: '#313035',
                            fontFamily: 'SFPro',
                            fontWeight: 500,
                            borderRadius: '0.00vh',
                            fontSize: '1.02vh',
                            lineHeight: '1.02vh',
                            letterSpacing: '0.04em',
                            color: 'rgba(255, 255, 255, 0.5)'
                        }
                    }}
                        onFocus={() => fetchNui('disableControls', true)}
                        onBlur={() => fetchNui('disableControls', false)}
                        onChange={(e) => setFirstName(e.currentTarget.value)}
                    />
                    <TextInput value={lastName} placeholder="Last Name" w={'100%'} h={'2.78vh'} mt={'0.27vh'} styles={{
                        input: {
                            width: '100%',
                            minHeight: '1.39vh',
                            height: '2.78vh',
                            border: 'none',
                            background: '#313035',
                            fontFamily: 'SFPro',
                            fontWeight: 500,
                            borderRadius: '0.00vh',
                            fontSize: '1.02vh',
                            lineHeight: '1.02vh',
                            letterSpacing: '0.04em',
                            color: 'rgba(255, 255, 255, 0.5)'
                        }
                    }}
                        onFocus={() => fetchNui('disableControls', true)}
                        onBlur={() => fetchNui('disableControls', false)}
                        onChange={(e) => setLastName(e.currentTarget.value)}
                    />
                    <NumberInput value={phoneNumber} placeholder="Phone Number" w={'100%'} h={'2.78vh'} mt={'0.27vh'} styles={{
                        input: {
                            width: '100%',
                            minHeight: '1.39vh',
                            height: '2.78vh',
                            border: 'none',
                            background: '#313035',
                            fontFamily: 'SFPro',
                            fontWeight: 500,
                            borderRadius: '0.00vh',
                            fontSize: '1.02vh',
                            lineHeight: '1.02vh',
                            letterSpacing: '0.04em',
                            color: 'rgba(255, 255, 255, 0.5)'
                        }
                    }}
                        onFocus={() => fetchNui('disableControls', true)}
                        onBlur={() => fetchNui('disableControls', false)}
                        onChange={(e) => setPhoneNumber(e.toString())}
                        rightSection={<></>}
                    />

                    <Textarea value={notes} placeholder="Notes" w={'100%'} h={'10.56vh'} mt={'1.20vh'} styles={{
                        input: {
                            width: '100%',
                            minHeight: '2.78vh',
                            height: '10.56vh',
                            border: 'none',
                            background: '#313035',
                            fontFamily: 'SFPro',
                            fontWeight: 500,
                            borderRadius: '0.00vh',
                            fontSize: '1.02vh',
                            lineHeight: '1.02vh',
                            letterSpacing: '0.04em',
                            color: 'rgba(255, 255, 255, 0.5)'
                        }
                    }}
                        onFocus={() => fetchNui('disableControls', true)}
                        onBlur={() => fetchNui('disableControls', false)}
                        onChange={(e) => setNotes(e.currentTarget.value)}
                    />

                    <TextInput value={email} placeholder="Email" w={'100%'} h={'2.78vh'} mt={'1.02vh'} styles={{
                        input: {
                            width: '100%',
                            minHeight: '1.39vh',
                            height: '2.78vh',
                            border: 'none',
                            background: '#313035',
                            fontFamily: 'SFPro',
                            fontWeight: 500,
                            borderRadius: '0.00vh',
                            fontSize: '1.02vh',
                            lineHeight: '1.02vh',
                            letterSpacing: '0.04em',
                            color: 'rgba(255, 255, 255, 0.5)'
                        }
                    }}
                        leftSection={
                            <svg width="1.30vh" height="1.30vh" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="7" cy="7" r="7" fill="url(#paint0_linear_241_190)" />
                                <path d="M6.65714 6.65714V3H7.34286V6.65714H11V7.34286H7.34286V11H6.65714V7.34286H3V6.65714H6.65714Z" fill="white" />
                                <defs>
                                    <linearGradient id="paint0_linear_241_190" x1="4" y1="14" x2="10.5" y2="3.05474e-07" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#6BFF46" />
                                        <stop offset="1" stopColor="#22A900" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        }
                        onFocus={() => fetchNui('disableControls', true)}
                        onBlur={() => fetchNui('disableControls', false)}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                    />
                </div>
            )}
        </Transition >
    )
}