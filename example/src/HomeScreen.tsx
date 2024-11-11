import { NavigationContext } from '@react-navigation/native'
import moment from 'moment'
import React, { useContext, useEffect, useState } from 'react'
import {
  Button,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  Conversation,
  Client,
  useXmtp,
  DecodedMessage,
} from 'xmtp-react-native-sdk'
import { Group } from 'xmtp-react-native-sdk/lib/Group'

import { SupportedContentTypes } from './contentTypes/contentTypes'
import { useConversationList, useGroupsList, useMessages } from './hooks'

/// Show the user's list of conversations.

export default function HomeScreen() {
  const { client } = useXmtp()
  const {
    data: conversations,
    refetch,
    isFetching,
    isRefetching,
  } = useConversationList()
  const {
    data: groups,
    refetch: refetchGroups,
    isFetching: isFetchingGroups,
    isRefetching: isRefetchingGroups,
  } = useGroupsList()
  return (
    <>
      <View>
        <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
          DMs
        </Text>
        <FlatList
          refreshing={isFetching || isRefetching}
          onRefresh={refetch}
          data={conversations || []}
          keyExtractor={(item) => item.topic}
          renderItem={({ item: conversation }) => (
            <ConversationItem conversation={conversation} client={client} />
          )}
          ListHeaderComponent={
            <View
              style={{
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: 16,
                paddingRight: 16,
                backgroundColor: '#eee',
                borderBottomColor: 'gray',
                borderBottomWidth: StyleSheet.hairlineWidth,
              }}
            >
              <Text style={{ fontSize: 14 }}>Connected as</Text>
              <Text selectable style={{ fontSize: 14, fontWeight: 'bold' }}>
                {client?.address}
              </Text>
            </View>
          }
        />
      </View>
      <View>
        <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
          Groups
        </Text>
        <FlatList
          refreshing={isFetchingGroups || isRefetchingGroups}
          onRefresh={refetchGroups}
          data={groups || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item: group }) => (
            <GroupListItem group={group} client={client} />
          )}
        />
      </View>
    </>
  )
}

function GroupListItem({
  group,
  client,
}: {
  group: Group<any>
  client: Client<any> | null
}) {
  const navigation = useContext(NavigationContext)
  const [messages, setMessages] = useState<
    DecodedMessage<SupportedContentTypes>[]
  >([])
  const lastMessage = messages?.[0]
  const [consentState, setConsentState] = useState<string | undefined>()

  const denyGroup = async () => {
    await group.updateConsent('denied')
    const consent = await group.consentState()
    setConsentState(consent)
  }

  useEffect(() => {
    group
      ?.sync()
      .then(() => group.messages())
      .then(setMessages)
      .then(() => group.consentState())
      .then((result) => {
        setConsentState(result)
      })
      .catch((e) => {
        console.error('Error fetching group messages: ', e)
      })
  }, [group])

  return (
    <Pressable
      onPress={() =>
        navigation!.navigate('group', {
          id: group.id,
        })
      }
    >
      <View
        style={{
          flexDirection: 'row',
          padding: 8,
        }}
      >
        <View style={{ padding: 4 }}>
          <Text style={{ fontWeight: 'bold' }}>
            ({messages?.length} messages)
          </Text>
          <Button
            title="Deny"
            onPress={denyGroup}
            disabled={consentState === 'denied'}
          />
        </View>
        <View style={{ padding: 4 }}>
          <Text style={{ fontWeight: 'bold', color: 'red' }}>
            {consentState}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail">
            {lastMessage?.fallback}
          </Text>
          <Text>{lastMessage?.senderAddress}:</Text>
          <Text>{moment(lastMessage?.sentNs / 1000000).fromNow()}</Text>
        </View>
      </View>
    </Pressable>
  )
}

function ConversationItem({
  conversation,
  client,
}: {
  conversation: Conversation<any>
  client: Client<any> | null
}) {
  const navigation = useContext(NavigationContext)
  const { data: messages } = useMessages({ topic: conversation.topic })
  const lastMessage = messages?.[0]
  const [getConsentState, setConsentState] = useState<string | undefined>()

  useEffect(() => {
    conversation
      .consentState()
      .then((result) => {
        setConsentState(result)
      })
      .catch((e) => {
        console.error('Error setting consent state: ', e)
      })
  }, [conversation])

  const denyContact = async () => {
    await conversation.updateConsent('denied')
    conversation
      .consentState()
      .then(setConsentState)
      .catch((e) => {
        console.error('Error denying contact: ', e)
      })
  }

  return (
    <Pressable
      onPress={() =>
        navigation!.navigate('conversation', {
          topic: conversation.topic,
        })
      }
    >
      <View
        style={{
          flexDirection: 'row',
          padding: 8,
        }}
      >
        <View style={{ padding: 4 }}>
          <Text style={{ fontWeight: 'bold' }}>
            ({messages?.length} messages)
          </Text>
          <Button
            title="Deny"
            onPress={denyContact}
            disabled={getConsentState === 'denied'}
          />
        </View>
        <View style={{ padding: 4 }}>
          <Text numberOfLines={1} ellipsizeMode="tail">
            {lastMessage?.fallback}
          </Text>
          <Text>{lastMessage?.senderAddress}:</Text>
          <Text>{moment(lastMessage?.sentNs / 1000000).fromNow()}</Text>
          <Text style={{ fontWeight: 'bold', color: 'red' }}>
            {getConsentState}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}
