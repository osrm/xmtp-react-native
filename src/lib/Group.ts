import { Client, InboxId, InstallationId } from './Client'
import { ConsentState } from './ConsentRecord'
import { ConversationBase, ConversationVersion } from './Conversation'
import { DecodedMessage } from './DecodedMessage'
import { Member } from './Member'
import { ConversationSendPayload } from './types/ConversationCodecs'
import { DecodedMessageUnion } from './types/DecodedMessageUnion'
import { DefaultContentTypes } from './types/DefaultContentType'
import { EventTypes } from './types/EventTypes'
import { MessageId, MessagesOptions } from './types/MessagesOptions'
import { PermissionPolicySet } from './types/PermissionPolicySet'
import { SendOptions } from './types/SendOptions'
import * as XMTP from '../index'
import { Address, ConversationId, ConversationTopic } from '../index'

export type PermissionUpdateOption = 'allow' | 'deny' | 'admin' | 'super_admin'

export interface GroupParams {
  id: ConversationId
  createdAt: number
  topic: ConversationTopic
  name: string
  isActive: boolean
  addedByInboxId: InboxId
  imageUrlSquare: string
  description: string
  consentState: ConsentState
  lastMessage?: DecodedMessage
}

export class Group<
  ContentTypes extends DefaultContentTypes = DefaultContentTypes,
> implements ConversationBase<ContentTypes>
{
  clientInstallationId: InstallationId
  id: ConversationId
  createdAt: number
  version = ConversationVersion.GROUP as const
  topic: ConversationTopic
  name: string
  isGroupActive: boolean
  addedByInboxId: InboxId
  imageUrlSquare: string
  description: string
  state: ConsentState
  lastMessage?: DecodedMessageUnion<ContentTypes>

  constructor(
    clientInstallationId: InstallationId,
    params: GroupParams,
    lastMessage?: DecodedMessageUnion<ContentTypes>
  ) {
    this.clientInstallationId = clientInstallationId
    this.id = params.id
    this.createdAt = params.createdAt
    this.topic = params.topic
    this.name = params.name
    this.isGroupActive = params.isActive
    this.addedByInboxId = params.addedByInboxId
    this.imageUrlSquare = params.imageUrlSquare
    this.description = params.description
    this.state = params.consentState
    this.lastMessage = lastMessage
  }

  /**
   * This method returns an array of inbox ids associated with the group.
   * To get the latest member inbox ids from the network, call sync() first.
   * @returns {Promise<InboxId[]>} A Promise that resolves to an array of InboxId objects.
   */
  async memberInboxIds(): Promise<InboxId[]> {
    return XMTP.listMemberInboxIds(this.clientInstallationId, this.id)
  }

  /**
   * This method returns a inbox id associated with the creator of the group.
   * @returns {Promise<InboxId>} A Promise that resolves to a InboxId.
   */
  async creatorInboxId(): Promise<InboxId> {
    return XMTP.creatorInboxId(this.clientInstallationId, this.id)
  }

  /**
   * Sends a message to the current group.
   *
   * @param {string | MessageContent} content - The content of the message. It can be either a string or a structured MessageContent object.
   * @returns {Promise<MessageId>} A Promise that resolves to a string identifier for the sent message.
   * @throws {Error} Throws an error if there is an issue with sending the message.
   */
  async send<SendContentTypes extends DefaultContentTypes = ContentTypes>(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions
  ): Promise<MessageId> {
    if (opts && opts.contentType) {
      return await this._sendWithJSCodec(content, opts.contentType)
    }

    try {
      if (typeof content === 'string') {
        content = { text: content }
      }

      return await XMTP.sendMessage(this.clientInstallationId, this.id, content)
    } catch (e) {
      console.info('ERROR in send()', e.message)
      throw e
    }
  }

  private async _sendWithJSCodec<T>(
    content: T,
    contentType: XMTP.ContentTypeId
  ): Promise<MessageId> {
    const codec =
      Client.codecRegistry[
        `${contentType.authorityId}/${contentType.typeId}:${contentType.versionMajor}.${contentType.versionMinor}`
      ]

    if (!codec) {
      throw new Error(`no codec found for: ${contentType}`)
    }

    return await XMTP.sendWithContentType(
      this.clientInstallationId,
      this.id,
      content,
      codec
    )
  }

  /**
   * Prepare a group message to be sent.
   *
   * @param {string | MessageContent} content - The content of the message. It can be either a string or a structured MessageContent object.
   * @returns {Promise<MessageId>} A Promise that resolves to a string identifier for the prepared message to be sent.
   * @throws {Error} Throws an error if there is an issue with sending the message.
   */
  async prepareMessage<
    SendContentTypes extends DefaultContentTypes = ContentTypes,
  >(
    content: ConversationSendPayload<SendContentTypes>,
    opts?: SendOptions
  ): Promise<MessageId> {
    if (opts && opts.contentType) {
      return await this._prepareWithJSCodec(content, opts.contentType)
    }

    try {
      if (typeof content === 'string') {
        content = { text: content }
      }

      return await XMTP.prepareMessage(
        this.clientInstallationId,
        this.id,
        content
      )
    } catch (e) {
      console.info('ERROR in prepareGroupMessage()', e.message)
      throw e
    }
  }

  private async _prepareWithJSCodec<T>(
    content: T,
    contentType: XMTP.ContentTypeId
  ): Promise<MessageId> {
    const codec =
      Client.codecRegistry[
        `${contentType.authorityId}/${contentType.typeId}:${contentType.versionMajor}.${contentType.versionMinor}`
      ]

    if (!codec) {
      throw new Error(`no codec found for: ${contentType}`)
    }

    return await XMTP.prepareMessageWithContentType(
      this.clientInstallationId,
      this.id,
      content,
      codec
    )
  }

  /**
   * Publish all prepared messages.
   *
   * @throws {Error} Throws an error if there is an issue finding the unpublished message
   */
  async publishPreparedMessages() {
    try {
      return await XMTP.publishPreparedMessages(
        this.clientInstallationId,
        this.id
      )
    } catch (e) {
      console.info('ERROR in publishPreparedMessages()', e.message)
      throw e
    }
  }

  /**
   * This method returns an array of messages associated with the group.
   * To get the latest messages from the network, call sync() first.
   *
   * @param {number | undefined} limit - Optional maximum number of messages to return.
   * @param {number | Date | undefined} before - Optional filter for specifying the maximum timestamp of messages to return.
   * @param {number | Date | undefined} after - Optional filter for specifying the minimum timestamp of messages to return.
   * @param direction - Optional parameter to specify the time ordering of the messages to return.
   * @returns {Promise<DecodedMessage<ContentTypes>[]>} A Promise that resolves to an array of DecodedMessage objects.
   */

  async messages(
    opts?: MessagesOptions
  ): Promise<DecodedMessageUnion<ContentTypes>[]> {
    return await XMTP.conversationMessages(
      this.clientInstallationId,
      this.id,
      opts?.limit,
      opts?.beforeNs,
      opts?.afterNs,
      opts?.direction
    )
  }

  /**
   * Executes a network request to fetch the latest messages and membership changes
   * associated with the group and saves them to the local state.
   */
  async sync() {
    await XMTP.syncConversation(this.clientInstallationId, this.id)
  }

  /**
   * Sets up a real-time message stream for the current group.
   *
   * This method subscribes to incoming messages in real-time and listens for new message events.
   * When a new message is detected, the provided callback function is invoked with the details of the message.
   * Additionally, this method returns a function that can be called to unsubscribe and end the message stream.
   *
   * @param {Function} callback - A callback function that will be invoked with the new DecodedMessage when a message is received.
   * @returns {Function} A function that, when called, unsubscribes from the message stream and ends real-time updates.
   */
  async streamMessages(
    callback: (message: DecodedMessage<ContentTypes[number]>) => Promise<void>
  ): Promise<() => void> {
    await XMTP.subscribeToMessages(this.clientInstallationId, this.id)
    const messageSubscription = XMTP.emitter.addListener(
      EventTypes.ConversationMessage,
      async ({
        installationId,
        message,
        conversationId,
      }: {
        installationId: string
        message: DecodedMessage<ContentTypes[number]>
        conversationId: string
      }) => {
        if (installationId !== this.clientInstallationId) {
          return
        }
        if (conversationId !== this.id) {
          return
        }

        await callback(DecodedMessage.fromObject(message))
      }
    )
    return async () => {
      messageSubscription.remove()
      await XMTP.unsubscribeFromMessages(this.clientInstallationId, this.id)
    }
  }
  /**
   *
   * @param addresses addresses to add to the group
   * @returns
   */
  async addMembers(addresses: Address[]): Promise<void> {
    return XMTP.addGroupMembers(this.clientInstallationId, this.id, addresses)
  }

  /**
   *
   * @param addresses addresses to remove from the group
   * @returns
   */
  async removeMembers(addresses: Address[]): Promise<void> {
    return XMTP.removeGroupMembers(
      this.clientInstallationId,
      this.id,
      addresses
    )
  }

  /**
   *
   * @param inboxIds inboxIds to add to the group
   * @returns
   */
  async addMembersByInboxId(inboxIds: InboxId[]): Promise<void> {
    return XMTP.addGroupMembersByInboxId(
      this.clientInstallationId,
      this.id,
      inboxIds
    )
  }

  /**
   *
   * @param inboxIds inboxIds to remove from the group
   * @returns
   */
  async removeMembersByInboxId(inboxIds: InboxId[]): Promise<void> {
    return XMTP.removeGroupMembersByInboxId(
      this.clientInstallationId,
      this.id,
      inboxIds
    )
  }

  /**
   * Returns the group name.
   * To get the latest group name from the network, call sync() first.
   * @returns {string} A Promise that resolves to the group name.
   */
  async groupName(): Promise<string> {
    return XMTP.groupName(this.clientInstallationId, this.id)
  }

  /**
   * Updates the group name.
   * Will throw if the user does not have the required permissions.
   * @param {string} groupName new group name
   * @returns
   */

  async updateGroupName(groupName: string): Promise<void> {
    return XMTP.updateGroupName(this.clientInstallationId, this.id, groupName)
  }

  /**
   * Returns the group image url square.
   * To get the latest group image url square from the network, call sync() first.
   * @returns {string} A Promise that resolves to the group image url.
   */
  async groupImageUrlSquare(): Promise<string> {
    return XMTP.groupImageUrlSquare(this.clientInstallationId, this.id)
  }

  /**
   * Updates the group image url square.
   * Will throw if the user does not have the required permissions.
   * @param {string} imageUrlSquare new group profile image url
   * @returns
   */

  async updateGroupImageUrlSquare(imageUrlSquare: string): Promise<void> {
    return XMTP.updateGroupImageUrlSquare(
      this.clientInstallationId,
      this.id,
      imageUrlSquare
    )
  }

  /**
   * Returns the group description.
   * To get the latest group description from the network, call sync() first.
   * @returns {string} A Promise that resolves to the group description.
   */
  async groupDescription(): Promise<string> {
    return XMTP.groupDescription(this.clientInstallationId, this.id)
  }

  /**
   * Updates the group description.
   * Will throw if the user does not have the required permissions.
   * @param {string} description new group description
   * @returns
   */

  async updateGroupDescription(description: string): Promise<void> {
    return XMTP.updateGroupDescription(
      this.clientInstallationId,
      this.id,
      description
    )
  }

  /**
   * Returns the group pinned frame.
   * To get the latest group pinned frame url from the network, call sync() first.
   * @returns {string} A Promise that resolves to the group pinned frame url.
   */
  async groupPinnedFrameUrl(): Promise<string> {
    return XMTP.groupPinnedFrameUrl(this.clientInstallationId, this.id)
  }

  /**
   * Updates the group pinned frame url.
   * Will throw if the user does not have the required permissions.
   * @param {string} pinnedFrameUrl new group pinned frame url
   * @returns
   */

  async updateGroupPinnedFrameUrl(pinnedFrameUrl: string): Promise<void> {
    return XMTP.updateGroupPinnedFrameUrl(
      this.clientInstallationId,
      this.id,
      pinnedFrameUrl
    )
  }

  /**
   * Returns whether the group is active.
   * To get the latest active status from the network, call sync() first
   * @returns {Promise<boolean>} A Promise that resolves if the group is active or not
   */

  async isActive(): Promise<boolean> {
    return XMTP.isGroupActive(this.clientInstallationId, this.id)
  }

  /**
   *
   * @param inboxId
   * @returns {Promise<boolean>} whether a given inboxId is an admin of the group.
   * To get the latest admin status from the network, call sync() first.
   */
  async isAdmin(inboxId: InboxId): Promise<boolean> {
    return XMTP.isAdmin(this.clientInstallationId, this.id, inboxId)
  }

  /**
   *
   * @param inboxId
   * @returns {Promise<boolean>} whether a given inboxId is a super admin of the group.
   * To get the latest super admin status from the network, call sync() first.
   */
  async isSuperAdmin(inboxId: InboxId): Promise<boolean> {
    return XMTP.isSuperAdmin(this.clientInstallationId, this.id, inboxId)
  }

  /**
   *
   * @returns {Promise<string[]>} A Promise that resolves to an array of inboxIds that are admins of the group.
   * To get the latest admin list from the network, call sync() first.
   */
  async listAdmins(): Promise<InboxId[]> {
    return XMTP.listAdmins(this.clientInstallationId, this.id)
  }

  /**
   *
   * @returns {Promise<string[]>} A Promise that resolves to an array of inboxIds that are super admins of the group.
   * To get the latest super admin list from the network, call sync() first.
   */
  async listSuperAdmins(): Promise<InboxId[]> {
    return XMTP.listSuperAdmins(this.clientInstallationId, this.id)
  }

  /**
   *
   * @param {InboxId} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is added to the group admins.
   * Will throw if the user does not have the required permissions.
   */
  async addAdmin(inboxId: InboxId): Promise<void> {
    return XMTP.addAdmin(this.clientInstallationId, this.id, inboxId)
  }

  /**
   *
   * @param {InboxId} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is added to the group super admins.
   * Will throw if the user does not have the required permissions.
   */
  async addSuperAdmin(inboxId: InboxId): Promise<void> {
    return XMTP.addSuperAdmin(this.clientInstallationId, this.id, inboxId)
  }

  /**
   *
   * @param {InboxId} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is removed from the group admins.
   * Will throw if the user does not have the required permissions.
   */
  async removeAdmin(inboxId: InboxId): Promise<void> {
    return XMTP.removeAdmin(this.clientInstallationId, this.id, inboxId)
  }

  /**
   *
   * @param {InboxId} inboxId
   * @returns {Promise<void>} A Promise that resolves when the inboxId is removed from the group super admins.
   * Will throw if the user does not have the required permissions.
   */
  async removeSuperAdmin(inboxId: InboxId): Promise<void> {
    return XMTP.removeSuperAdmin(this.clientInstallationId, this.id, inboxId)
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the addMember permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateAddMemberPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateAddMemberPermission(
      this.clientInstallationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the removeMember permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateRemoveMemberPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateRemoveMemberPermission(
      this.clientInstallationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the addAdmin permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateAddAdminPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateAddAdminPermission(
      this.clientInstallationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the removeAdmin permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateRemoveAdminPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateRemoveAdminPermission(
      this.clientInstallationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the groupName permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateGroupNamePermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateGroupNamePermission(
      this.clientInstallationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the groupImageUrlSquare permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateGroupImageUrlSquarePermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateGroupImageUrlSquarePermission(
      this.clientInstallationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the groupDescription permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateGroupDescriptionPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateGroupDescriptionPermission(
      this.clientInstallationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @param {PermissionOption} permissionOption
   * @returns {Promise<void>} A Promise that resolves when the groupPinnedFrameUrl permission is updated for the group.
   * Will throw if the user does not have the required permissions.
   */
  async updateGroupPinnedFrameUrlPermission(
    permissionOption: PermissionUpdateOption
  ): Promise<void> {
    return XMTP.updateGroupPinnedFrameUrlPermission(
      this.clientInstallationId,
      this.id,
      permissionOption
    )
  }

  /**
   *
   * @returns {Promise<PermissionPolicySet>} A {PermissionPolicySet} object representing the group's permission policy set.
   */
  async permissionPolicySet(): Promise<PermissionPolicySet> {
    return XMTP.permissionPolicySet(this.clientInstallationId, this.id)
  }

  async processMessage(
    encryptedMessage: string
  ): Promise<DecodedMessage<ContentTypes[number]>> {
    try {
      return await XMTP.processMessage(
        this.clientInstallationId,
        this.id,
        encryptedMessage
      )
    } catch (e) {
      console.info('ERROR in processGroupMessage()', e)
      throw e
    }
  }

  async consentState(): Promise<ConsentState> {
    return await XMTP.conversationConsentState(
      this.clientInstallationId,
      this.id
    )
  }

  async updateConsent(state: ConsentState): Promise<void> {
    return await XMTP.updateConversationConsent(
      this.clientInstallationId,
      this.id,
      state
    )
  }

  /**
   *
   * @returns {Promise<Member[]>} A Promise that resolves to an array of Member objects.
   * To get the latest member list from the network, call sync() first.
   */
  async members(): Promise<Member[]> {
    return await XMTP.listConversationMembers(
      this.clientInstallationId,
      this.id
    )
  }
}
