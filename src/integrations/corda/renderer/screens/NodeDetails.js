import connect from "../../../../renderer/screens/helpers/connect";

import { hashHistory } from "react-router";
import React, { Component } from "react";
import NodeLink from "../components/NodeLink";
import CordAppLink from "../components/CordAppLink";
import TransactionLink from "../components/TransactionLink";

// this is taken from braid
const VERSION_REGEX = /^(.*?)(?:-(?:(?:\d|\.)+))\.jar?$/;

function filterNodeBy(nodeToMatch) {
  return (node) => {
    return node.safeName === nodeToMatch;
  }
}

class NodeDetails extends Component {
  constructor(props) {
    super(props);

    this.state = {node: this.findNodeFromProps(), nodes:[], notaries:[], cordapps:[], transactions: {}};
  }

  findNodeFromProps(){
    const workspace = this.props.config.settings.workspace;
    const isNode = filterNodeBy(this.props.params.node);
    let matches = [...workspace.nodes, ...workspace.notaries].filter(isNode);
    return matches[0] || null;
  }

  componentDidMount(){
    this.refresh();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.params.node !== this.props.params.node) {
      this.setState({node: this.findNodeFromProps(), nodes:[], notaries:[], cordapps:[], transactions: {}}, this.refresh.bind(this));
    }
    if (prevProps.config.updated !== this.props.config.updated) {
      this.refresh();
    }
  }

  refresh() {
    if (this.state.node) {
      const notariesProm = fetch("https://localhost:" + (this.state.node.rpcPort + 10000) + "/api/rest/network/notaries")
        .then(r => r.json());

      notariesProm.then(notaries => this.setState({notaries}));

      fetch("https://localhost:" + (this.state.node.rpcPort + 10000) + "/api/rest/network/nodes")
        .then(r => r.json())
        .then(async nodes => {
          const selfName = this.state.node.name.replace(/\s/g, "");
          const notaries = await notariesProm;
          const notariesMap = new Set(notaries.map(notary => notary.owningKey));
          const nodesOnly = nodes.filter(node => {
            return node.legalIdentities.some(nodeIdent => {
              // filter out self
              if (nodeIdent.name.replace(/\s/g,"") === selfName) {
                return false;
              } else {
                // filter out notaries
                return !notariesMap.has(nodeIdent.owningKey);
              }
            });
          });
          this.setState({nodes: nodesOnly});
        });

      fetch("https://localhost:" + (this.state.node.rpcPort + 10000) + "/api/rest/cordapps")
        .then(r => r.json())
        .then(cordapps => this.setState({cordapps}));

      fetch("https://localhost:" + (this.state.node.rpcPort + 10000) + "/api/rest/network/nodes/self")
        .then(r => r.json())
        .then(self => {
          fetch("https://localhost:" + (this.state.node.rpcPort + 10000) + "/api/rest/vault/vaultQueryBy", {
            method: "POST",
            headers: {
              "accept": "application/json",
              "content-type": "application/json"
            },
            body: JSON.stringify({
              "criteria" : {
                "@class" : ".QueryCriteria$VaultQueryCriteria",
                "status" : "ALL",
                // "contractStateTypes" : null,
                // "stateRefs" : [{txhash: this.props.params.txhash}],
                // "notary" : null,
                // "softLockingCondition" : null,
                // "timeCondition" : {
                //   "type" : "RECORDED",
                //   "predicate" : {
                //     "@class" : ".ColumnPredicate${'$'}Between",
                //     "rightFromLiteral" : "2019-09-15T12:58:23.283Z",
                //     "rightToLiteral" : "2019-10-15T12:58:23.283Z"
                //   }
                // },
                // "relevancyStatus" : "ALL",
                // "constraintTypes" : [ ],
                // "constraints" : [ ],
                "participants" : self.legalIdentities
              },
              // "paging" : {
              //   "pageNumber" : -1,
              //   "pageSize" : 200
              // },
              // "sorting" : {
              //   "columns" : [ ]
              // },
              // "contractStateType" : "net.corda.core.contracts.ContractState"
            })
          })
          .then(res => res.json())
          .then(transactions => this.setState({transactions}))
        });
    }
  }

  getWorkspaceNode(owningKey){
    return this.props.config.settings.workspace.nodes.find(node => owningKey === node.owningKey);
  }

  getWorkspaceNotary(owningKey){
    return this.props.config.settings.workspace.notaries.find(notary => owningKey === notary.owningKey);
  }

  getWorkspaceCordapp(name) {
    return this.props.config.settings.workspace.projects.find(cordapp => VERSION_REGEX.exec(cordapp)[1].toLowerCase().endsWith(name.toLowerCase()));
  }

  render() {
    if (!this.state.node) {
      return (<div>Couldn&apos;t locate node {this.props.params.node}</div>);
    }

    const transactionStates = TransactionLink
      .joinAndSort(this.state.transactions.states, this.state.transactions.statesMetadata);
    return (
      <div>
        <div className="TitleBar">
          <button className="Button" onClick={hashHistory.goBack}>
            &larr; Back
          </button>
          <h1 className="Title">
            {this.state.node.name}
          </h1>
        </div>
        <main>
          <div>

            <div>Nodes</div>
            <div className="Nodes DataRows">
              <main>
                {this.state.nodes.map(node => {
                  const workspaceNode = this.getWorkspaceNode(node.legalIdentities[0].owningKey);
                  if (workspaceNode) {
                    return (<NodeLink key={`node-${workspaceNode.safeName}`} node={workspaceNode} />);
                  } else {
                    return ("");
                  }
                })}
              </main>
            </div>
            <hr />

            <div>Notaries</div>
            <div className="Nodes DataRows">
              <main>
                {this.state.notaries.map(notary => {
                  const workspaceNode = this.getWorkspaceNotary(notary.owningKey);
                  if (workspaceNode) {
                    return (<NodeLink key={`node-${workspaceNode.safeName}`} node={workspaceNode} />);
                  } else {
                    return (<div key={`unknown-node-${notary.name}`}>{notary.name}</div>);
                  }
                })}
              </main>
            </div>
            <hr />

            <div>CorDapps</div>
            <div className="Nodes DataRows">
              <main>
                {this.state.cordapps.map(cordapp => {
                  const workspaceCordapp = this.getWorkspaceCordapp(cordapp);
                  if (workspaceCordapp) {
                    return (<CordAppLink key={workspaceCordapp} cordapp={workspaceCordapp}>{workspaceCordapp}</CordAppLink>);
                  } else {
                    return ("");
                  }
                })}
              </main>
            </div>
            <hr />

            <div>Transactions</div>
            <div className="Nodes DataRows">
              <main>
                {transactionStates.map(transaction => {
                  return (<TransactionLink key={transaction.ref.txhash + "/" + transaction.ref.index} tx={transaction} node={this.state.node} />);
                })}
              </main>
            </div>
          </div>
        </main>
      </div>
    );
  }
}

export default connect(
  NodeDetails,
  "config"
);